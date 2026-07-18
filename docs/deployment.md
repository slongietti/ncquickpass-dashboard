# Deployment — AWS Lambda (container) + Neon + CloudFront

The app ships as **one container image** (NestJS API that also serves the Angular
SPA, same-origin) running on **AWS Lambda** behind **CloudFront**, with **Neon**
(serverless Postgres) as the database and **EventBridge Scheduler** driving the
daily background reconcile. Region: **us-east-1** (co-located with Neon).

```
 ncquickpass.go-volare.com
        │
   CloudFront ── ACM cert (us-east-1)
        │  (caches SPA assets; forwards /api/* + cookies)
   Lambda Function URL
        │
   Lambda (container: API + SPA)  ──►  Neon (Postgres)
        ▲                          ──►  KMS (decrypt stored credentials)
        │
   EventBridge Scheduler (daily) ── invoke, input {"secret": CRON_SECRET}
```

CI/CD is already wired (`.github/workflows/build.yml` + `release.yml`); they only
**build/push/deploy**. The AWS + Neon **infrastructure below is provisioned once, by
hand.** After that, `main` push → image → draft release → publish release → deploy.

---

## 0. Prerequisites

- AWS account with admin access; `aws` CLI configured; region `us-east-1`.
- The Neon project (already created). Grab **two** connection strings from the Neon
  console → Connect:
  - **Pooled** (has `-pooler` in the host) → the app's runtime `DATABASE_URL`.
  - **Direct** (no `-pooler`) → migrations (`DATABASE_URL` in the `production` GH Environment).
- `go-volare.com` hosted zone in Route 53 (same as `fishon.go-volare.com`).

Set shell vars used below:

```bash
export AWS_REGION=us-east-1
export ACCT=$(aws sts get-caller-identity --query Account --output text)
export REPO=ncquickpass          # ECR repo + Lambda function name + image name
export FUNCTION=ncquickpass
```

---

## 1. Neon — initialize the schema

Run once (and on any release the workflow will do this automatically). Uses the
**direct** connection string:

```bash
cd api
DATABASE_URL="postgresql://<user>:<pw>@<host-no-pooler>/<db>?sslmode=require" \
  npx prisma migrate deploy
```

> Rotate the connection password after setup if it was shared in plaintext.

---

## 2. ECR repository

`push-container-image.yml` does **not** auto-create repos.

```bash
aws ecr create-repository --repository-name "$REPO" --region "$AWS_REGION"
```

---

## 3. KMS key for credential encryption (CREDENTIAL_KEY)

The unattended scheduler stores NCQP credentials encrypted; production uses a KMS
customer-managed key so the app never holds key material.

```bash
aws kms create-key --description "ncquickpass credential vault" --region "$AWS_REGION"
# note the KeyId → arn:aws:kms:us-east-1:$ACCT:key/<KeyId>  → this is CREDENTIAL_KEY
aws kms create-alias --alias-name alias/ncquickpass --target-key-id <KeyId>
```

Grant **only** the Lambda execution role `kms:Encrypt`/`Decrypt`/`GenerateDataKey`
on this key (via the key policy) — no human principals.

---

## 4. GitHub OIDC → IAM role (OIDC_AWS_ROLE_ARN)

If the org already has the GitHub OIDC provider (fishon uses it), reuse it;
otherwise create it (`token.actions.githubusercontent.com`). Create a role trusted
by this repo with a policy allowing: ECR auth/push/pull, `lambda:UpdateFunctionCode`,
`lambda:GetFunction`. Set its ARN as the **org or repo secret `OIDC_AWS_ROLE_ARN`**
(the workflows read `${{ secrets.OIDC_AWS_ROLE_ARN }}`).

Trust policy `sub` condition: `repo:Volare-Consulting-Software/ncquickpass-dashboard:*`.

---

## 5. First image (bootstrap the Lambda)

The Lambda create needs an image to exist. Either push once locally, or run the
`build` workflow on `main` first, then create the function from that tag.

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ACCT.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build -t "$ACCT.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO:bootstrap" .
docker push "$ACCT.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO:bootstrap"
```

---

## 6. Lambda function (container image)

Create an execution role (`lambda-ncquickpass-exec`) with `AWSLambdaBasicExecutionRole`
plus the KMS grant from step 3. Then:

```bash
aws lambda create-function \
  --function-name "$FUNCTION" \
  --package-type Image \
  --code ImageUri="$ACCT.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO:bootstrap" \
  --role "arn:aws:iam::$ACCT:role/lambda-ncquickpass-exec" \
  --timeout 30 --memory-size 1024 \
  --region "$AWS_REGION"
```

Set environment (never commit these — they live only on the function):

```bash
aws lambda update-function-configuration --function-name "$FUNCTION" --region "$AWS_REGION" \
  --environment "Variables={
    DATABASE_URL=<neon POOLED connection string>,
    COOKIE_SECRET=<long random>,
    COOKIE_SECURE=true,
    NCQP_BASE_URL=https://secure.ncquickpass.com,
    NCQP_CLIENT_ID=AMSExternalngAuthApp,
    CREDENTIAL_KEY=arn:aws:kms:us-east-1:$ACCT:key/<KeyId>,
    CRON_SECRET=<long random>
  }"
```

> Leave `CORS_ORIGIN` unset — the SPA is same-origin with the API, so CORS stays off.

Enable a **Function URL** (CloudFront is the only caller; keep it as the origin):

```bash
aws lambda create-function-url-config --function-name "$FUNCTION" \
  --auth-type NONE --region "$AWS_REGION"
```

---

## 7. CloudFront + ACM + Route 53 (ncquickpass.go-volare.com)

1. **ACM** (us-east-1): request a cert for `ncquickpass.go-volare.com`, DNS-validate
   via the `go-volare.com` hosted zone.
2. **CloudFront** distribution:
   - Origin = the Lambda Function URL domain (origin protocol HTTPS-only).
   - Behavior: forward all paths; **forward `Cookie` header + `Authorization`**;
     cache disabled for `/api/*` (or use CachingDisabled managed policy) so API and
     the session cookie work; static assets cache by default.
   - Alternate domain name = `ncquickpass.go-volare.com`; attach the ACM cert.
3. **Route 53**: A/AAAA **alias** record `ncquickpass.go-volare.com` → the CloudFront
   distribution (mirrors `fishon.go-volare.com`).

---

## 8. EventBridge Scheduler (daily reconcile)

Create a schedule that invokes the Lambda daily; the input carries `CRON_SECRET`
so the (public) `/api/internal/cron` endpoint accepts it. The Lambda Web Adapter
routes this non-HTTP invoke to `POST /api/internal/cron` (its pass-through path).

```bash
aws scheduler create-schedule \
  --name ncquickpass-daily-reconcile \
  --schedule-expression "cron(0 7 * * ? *)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target '{
    "Arn":"arn:aws:lambda:us-east-1:'"$ACCT"':function:'"$FUNCTION"'",
    "RoleArn":"arn:aws:iam::'"$ACCT"':role/scheduler-invoke-ncquickpass",
    "Input":"{\"secret\":\"<same CRON_SECRET as the function env>\"}"
  }' \
  --region "$AWS_REGION"
```

(`scheduler-invoke-ncquickpass` is a role EventBridge Scheduler assumes, allowing
`lambda:InvokeFunction` on the function.)

---

## 9. GitHub configuration (once)

- **Secret `OIDC_AWS_ROLE_ARN`** (org or repo) — from step 4.
- **Environment `production`** → secret **`DATABASE_URL`** = Neon **direct** string
  (used only by the release `db-deploy` migration job).
- Branch protection on `main` is already enforced (PR + no direct pushes).

---

## Release flow (after bootstrap)

1. Merge a PR to `main` → `build.yml` runs tests, pushes `ncquickpass:0.<minor>.<run#>`
   to ECR, and drafts a GitHub Release.
2. Publish that Release → `release.yml`:
   - `db-deploy` applies pending Prisma migrations to Neon (direct URL),
   - `deploy` points the Lambda at the released image tag,
   - `promote-latest` retags that image `:latest`.
3. CloudFront serves the updated Lambda at `https://ncquickpass.go-volare.com`.

## Cost note (near-zero)

Lambda, CloudFront (always-free tier), EventBridge Scheduler, and Neon are all
$0 at this scale. Standing costs: the KMS key (~$1/mo) and trivial ECR storage.

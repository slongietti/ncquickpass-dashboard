import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser(config.get<string>('COOKIE_SECRET')));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // CORS is only needed for a genuinely cross-origin browser. Every supported
  // setup keeps the SPA same-origin with the API (dev proxy, docker nginx, prod
  // CloudFront), so CORS stays OFF unless CORS_ORIGIN is explicitly set — no
  // localhost default that could leak into production.
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin, credentials: true });
  }

  const port = Number(config.get<string>('PORT', '3000'));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`BFF listening on http://localhost:${port}/api`);
}
void bootstrap();

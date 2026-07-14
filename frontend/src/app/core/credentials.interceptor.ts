import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Ensures the signed HttpOnly session cookie is sent with every API call.
 * Without withCredentials the browser omits the cookie on same-site XHR when
 * defaults differ, so we set it explicitly for all /api requests.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('/api')) {
    return next(req.clone({ withCredentials: true }));
  }
  return next(req);
};

// zap-napi/typescript/tests/http-methods.test.ts
import { zap } from '../src/public';
import { Router } from '../src/router';
import { JsRequest, JsResponse } from '../src/types';

describe('HTTP Methods Decorators', () => {
    let router: zap.Router;

    beforeEach(() => {
        router = new zap.Router();
    });

    @zap.controller('/api')
    class TestController {
        router: zap.Router;

        constructor(router: zap.Router) {
            this.router = router;
        }

        @zap.options('/test')
        async testOptions(request: zap.Request): Promise<zap.Response> {
            return zap.createResponse(204, {}, null);
        }

        @zap.head('/test')
        async testHead(request: zap.Request): Promise<zap.Response> {
            return zap.createResponse(200, {}, { message: 'HEAD success' });
        }
    }

    it('should handle OPTIONS requests', async () => {
        const controller = new TestController(router);
        const request = zap.createRequest('OPTIONS', '/api/test');
        const response = await router.handle(request);
        expect(response.status).toBe(204);
        expect(response.headers.Allow).toContain('GET');
        expect(response.headers.Allow).toContain('POST');
        expect(response.headers.Allow).toContain('PUT');
        expect(response.headers.Allow).toContain('DELETE');
        expect(response.headers.Allow).toContain('HEAD');
    });

    it('should handle HEAD requests', async () => {
        const controller = new TestController(router);
        const request = zap.createRequest('HEAD', '/api/test');
        const response = await router.handle(request);
        expect(response.status).toBe(200);
        expect(response.body).toBeUndefined(); // Body should be undefined for HEAD
    });
});
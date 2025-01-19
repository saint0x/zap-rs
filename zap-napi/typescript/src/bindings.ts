import { Router as NativeRouter } from 'zap-napi';

export function createRouter(): NativeRouter {
    return new NativeRouter();
}

export type { NativeRouter }; 
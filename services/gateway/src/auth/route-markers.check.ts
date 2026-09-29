import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService } from '@nestjs/core';
import { AUTH_KEY, PERMISSION_KEY } from '@brewlite/nest-common';

/**
 * Every route declares exactly one marker (conventions §6.3). A forgotten guard fails
 * open; this makes it fail at **boot** instead, listing every offending `METHOD path`.
 */
@Injectable()
export class RouteMarkersCheck implements OnApplicationBootstrap {
  constructor(private readonly discovery: DiscoveryService) {}

  onApplicationBootstrap(): void {
    const offenders: string[] = [];

    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance as object | undefined;
      if (!instance) continue;
      const prototype = Object.getPrototypeOf(instance) as object;
      const classRef = instance.constructor;
      const hasAuthOnClass = Reflect.hasMetadata(AUTH_KEY, classRef);
      const hasPermOnClass = Reflect.hasMetadata(PERMISSION_KEY, classRef);

      for (const methodName of Object.getOwnPropertyNames(prototype)) {
        if (methodName === 'constructor') continue;
        const handler = (prototype as Record<string, unknown>)[methodName];
        if (typeof handler !== 'function') continue;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        if (path === undefined) continue; // not a route handler

        const hasAuthOnMethod = Reflect.hasMetadata(AUTH_KEY, handler);
        const hasPermOnMethod = Reflect.hasMetadata(PERMISSION_KEY, handler);

        if (hasAuthOnMethod && hasPermOnMethod) {
          offenders.push(`${methodName} ${path} (both @Auth and @RequirePermission)`);
          continue;
        }
        if (hasAuthOnMethod || hasPermOnMethod) continue;
        if (!hasAuthOnClass && !hasPermOnClass) {
          offenders.push(`${methodName} ${path} (no marker)`);
        }
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `Every route needs exactly one auth marker — offenders: ${offenders.join(', ')}`,
      );
    }
  }
}

import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";
import { installUuidPolyfill } from "@/lib/forge/uuid";

installUuidPolyfill();

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    scrollRestoration: true,
  });
}

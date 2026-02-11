// My own, simple router
import type { entries } from "./types.js";
type route<T> = {
  precedence: number;
  value: T;
};
type routeTee<T> = {
  routes: route<T>[];
  children: routePath<T>;
  wildcards: routeTee<T>[];
  segmentName: string | undefined;
};
type routePath<T> = {
  [K in string]?: routeTee<T>;
};
type routes<T> = {
  [key: string]: {
    satisfies: string[];
    paths: routeTee<T>;
  };
};

type routeTypesDescriptor = {
  [key: string]: { satisfies?: string[] };
};
type getRouteTypes<rt> = [
  | keyof rt
  | Extract<
      rt[keyof rt],
      { satisfies: readonly string[] | string[] }
    >[][number]["satisfies"][number],
][number];
type PublicRoutes<descriptor extends routeTypesDescriptor> = {
  [key in getRouteTypes<descriptor>]: descriptor[key] & {
    /**
     * The paths of the route type. The first value is the path and the second is the value to pass back after the route being chosen by the router. The third is the presence (higher means will be further back in the results)
     */
    paths: { path: string; value: any; precedence: number }[];
  };
};

export class requestRouter<routesDescriptor extends routeTypesDescriptor, T> {
  _routes: routes<T> = {};
  _parsePath(path: string) {
    return path.split("/").filter(Boolean); // Remove empty segments
  }
  _precedenceIndex = 0;
  _modified = true;
  routes: PublicRoutes<routesDescriptor>;
  /**
   * Create a request router.
   * @param routeTypes The route type descriptor. Defaults to
   * {
   * use: { satisfies: ["get", "post"] },
   * get: {},
   * post: {},
   * }
   * @param autoBuild Rebuild the router before using a matcher if it has been modified. May not be changed after creation. Defaults to true.
   */
  constructor(
    routeTypes: routeTypesDescriptor = {
      use: { satisfies: ["get", "post"] },
      get: {},
      post: {},
    },
    autoBuild: boolean = true,
  ) {
    const changeModified = (newValue: boolean) => (this._modified = newValue);

    const routeTypeEntries = Object.entries(routeTypes);
    // Initialize .routes
    {
      const routes: PublicRoutes<routeTypesDescriptor> = {};
      for (const [typeName, info] of routeTypeEntries) {
        const pathsValue = autoBuild
          ? new Proxy(
              [] as PublicRoutes<routeTypesDescriptor>[string]["paths"],
              {
                set(target, p, newValue) {
                  target[p as any] = newValue;
                  changeModified(true);
                  return true;
                },
              },
            )
          : [];
        routes[typeName] = { satisfies: info["satisfies"], paths: pathsValue };
      }
      this.routes = routes as PublicRoutes<routesDescriptor>;
    }
    // Initialize ._routes
    this.build();
  }
  build(): void {
    const routeEntries = Object.entries(this.routes) as entries<
      typeof this.routes
    >[];
    this._routes = {};
    // Pass 1: Fill out routes with everything but the satisfiedBy filled out
    for (const [method, data] of routeEntries) {
      this._routes[method as string] = {
        satisfies: data.satisfies ?? [],
        paths: {
          routes: [],
          children: {},
          wildcards: [],
          segmentName: undefined,
        },
      };

      for (const { path, value, precedence } of data.paths) {
        const parsed = this._parsePath(path);
        let ref = this._routes[method as string]["paths"];
        for (const pathSegment of parsed) {
          if (pathSegment === "*" || pathSegment.startsWith(":")) {
            const segmentName = pathSegment.startsWith(":")
              ? pathSegment.slice(1)
              : undefined;
            const entry: routeTee<T> = {
              routes: [],
              children: {},
              wildcards: [],
              segmentName,
            };
            ref["wildcards"].push(entry);
            ref = entry;
          } else {
            ref["children"][pathSegment] ??= {
              routes: [],
              children: {},
              wildcards: [],
              segmentName: undefined,
            };
            ref = ref["children"][pathSegment];
          }
        }
        ref.routes.push({ value, precedence });
      }
    }
  }
  getRoutes(
    path: string,
    type: string,
  ): {
    item: route<T>;
    env: {
      [name: string]: string;
    };
  }[] {
    const parsed = this._parsePath(path);
    if (this._modified) {
      // This is not set if we are not in auto-build mode, so this is ok
      this.build();
    }
    function walk(
      item: routeTee<T>,
      path: string[],
      env: { [name: string]: string } = {},
      fork: number = 0,
    ): { item: route<T>; env: { [name: string]: string } }[] {
      let ref = item;
      let results: { item: route<T>; env: { [name: string]: string } }[] = [];
      function wildcards({
        segment,
        index,
      }: {
        segment: string;
        index: number;
      }) {
        for (const wildcard of ref?.wildcards ?? []) {
          const newEnv = { ...env };
          if (wildcard.segmentName) {
            if (wildcard.segmentName in env) {
              throw new Error(
                `Duplicate named wildcard ${wildcard.segmentName}`,
              );
            }
            newEnv[wildcard.segmentName] = segment;
          }
          results.push(...walk(wildcard, path.slice(index), newEnv, fork + 1));
        }
      }
      function handleRoutes() {
        results.push(
          ...ref.routes.map((item) => ({
            env: { ...env }, // clone JUST IN CASE
            item,
          })),
        );
      }
      // Add all "root" paths
      handleRoutes();

      for (let index = 0; index < path.length; index++) {
        const segment = path[index];
        // Add all of the wildcards don't check for this path segment
        wildcards({ segment, index });

        const tee = ref["children"][segment];
        if (!tee) {
          // If the path segment is not present we can not go any further
          return results;
        }

        ref = tee;
        // Add all of the paths that encompass all children of this node
        handleRoutes();
      }

      return results;
    }
    const satisfies = this._routes[type].satisfies;
    const satisfiesPaths = satisfies.map((key) => this._routes[key].paths);
    const results: ReturnType<typeof walk>[] = [];
    for (const walkable of [...satisfiesPaths, this._routes[type].paths]) {
      results.push(walk(walkable, parsed));
    }
    return results
      .flat(1)
      .sort((a, b) => a.item.precedence - b.item.precedence);
  }
}
/*
// TESTS
var routerDemo = new requestRouter({
  use: { satisfies: ["get", "post"] },
  get: {},
  post: {},
});
let idx = 0;
function add(type: string, path: string, item: unknown) {
  routerDemo.routes[type].paths.push({ path, value: item, precedence: idx++ });
}

add("use", "/chicken/bocks/no", "The no chicken bocks path!! Must include");
add(
  "use",
  "/chicken/bocks/no/brook.html",
  "The brook html file. Must include.",
);
add("use", "/chicken/bocks", "chicken bocks root of use. Must include.");

add("get", "/chicken/bocks", "the chicken bocks root of get. Must include.");
add("get", "/:chickenrelated/bocks/no/:file", "A wildcard. Must include.");
add("get", "/chicken/:bocks/no/:file", "A wildcard2. Must include.");
add("get", "/hi", "A unused GET path. Must not include.");
add("get", "/hi/:any", "A unused GET path with wildcards. Must not include.");
add("get", "/chicken/bocks/no/*", "A end wildcard that is TRUE. Must include.");
add(
  "get",
  "/chicken/bocks/no/brook.html/*",
  "A end wildcard that is FALSE. Must NOT include.",
);
add("get", "/", "root, MUST INCLUDE");
routerDemo.build();
console.log(routerDemo.getRoutes("/chicken/bocks/no/brook.html", "get"));
console.log(JSON.stringify(routerDemo._routes));
*/

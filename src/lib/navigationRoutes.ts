import { institutionalMenu, institutionalRoute, existingRouteOverrides } from './institutionalCatalog'

/** Every menu destination resolves to an existing workspace or a typed institutional workspace. */
export const navigationRoutes:Record<string,string>=Object.fromEntries(
  institutionalMenu.flatMap(group=>group.items.map(item=>[
    item.label,
    existingRouteOverrides[group.key+':'+item.key]??institutionalRoute(group.key,item.key)
  ]))
)
navigationRoutes.Dashboard='overview'

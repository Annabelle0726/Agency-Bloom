import type { Issue } from './domain'
import { resolveVisual, type VisualCategory } from './visual-library'

// Only explicit starting topics affect this quiet supporting artwork. It is
// neither a mood inference nor a recommendation. No paths or theme colors are
// embedded here; deployment, theme variants and cloud delivery stay centralized.
export function resolveHomeRecordVisual(issue:Issue|null,theme:string){
  if(!issue?.card.next_step.trim())return null
  const selected=[...new Set(issue.concerns)]
  const focus=issue.exploration_intent&&selected.includes(issue.exploration_intent)?issue.exploration_intent:selected.length===1?selected[0]:''
  const categories:Record<string,VisualCategory>={direction:'direction',job_search:'direction',change:'transition',choices:'choices',start:'growth',possibility:'growth',overload:'rest',relationships:'connection'}
  const category=categories[focus]
  const specific=category?resolveVisual({page:'shared',category,aspect:.8},theme,'card-thumbnail'):null
  return specific||resolveVisual({page:'shared',tags:['quiet','reading','reflection'],aspect:.8},theme,'card-thumbnail')
}

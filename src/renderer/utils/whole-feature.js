// Every place a feature occupies, so a selection can light the WHOLE feature up rather than only
// the part on the tile the option happens to point at.
//
// An engine option names one place of a feature, e.g. the road segment on the tile just placed.
// That is enough to identify the feature, but highlighting just that segment makes a 3-tile road
// look like a 1-tile one - misleading when the choice is "which road scores first".
//
// `featureOn` is the store getter: given a pointer it returns the feature with all of its places,
// matching on the feature type as well, since several inner features can share a location.
// Falls back to the option's own place when the feature cannot be resolved.
export const wholeFeaturePlaces = (option, featureOn) => {
  const feature = featureOn(option)
  if (!feature || !Array.isArray(feature.places) || feature.places.length === 0) {
    return [{ position: option.position, location: option.location }]
  }
  return feature.places.map(([x, y, location]) => ({ position: [x, y], location }))
}

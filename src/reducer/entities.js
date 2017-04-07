/**
 * Created by Andy on 3/27/2017.
 */

import {mergeFlags} from "atp-sugar";

export const UPDATE_ENTITY = "atp-entity/update";
export const UPDATE_ENTITIES = "atp-entity/update-multiple";

const _updateEntity = (state, type, entity) => state.$merge({
    [type]: {
        [entity.id]: (
            state[type] && state[type][entity.id] ? state[type][entity.id] : {}
        ).$merge(entity, mergeFlags.NONE)
    }
}, mergeFlags.RECURSIVE);

const _updateEntities = (state, type, entities) => entities.reduce(
    (combined, entity) => _updateEntity(combined, type, entity),
    state
);

export default (state = {}, action) =>
    action.type.$switch({
        [UPDATE_ENTITY]:   () => _updateEntity(state, action.entityType, action.entity),
        [UPDATE_ENTITIES]: () => _updateEntities(state, action.entityType, action.entities),
        default: () => state
    });

export const updateEntity = (entityType, entity) => ({type: UPDATE_ENTITY, entityType, entity});
export const updateEntities = (entityType, entities) => ({type: UPDATE_ENTITIES, entityType, entities});
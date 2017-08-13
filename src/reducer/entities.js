/**
 * Created by Andy on 3/27/2017.
 */

import {mergeFlags} from "atp-sugar";
import {o, a, mergeFlags} from "atp-sugar";
import rest from "atp-rest";

export const UPDATE_ENTITY = "atp-entity/update";
export const ENTITY_UPDATED = "atp-entity/updated";
export const DELETE_ENTITY = "atp-entity/delete";
export const ENTITY_DELETED = "atp-entity/deleted";
export const UPDATE_ENTITIES = "atp-entity/update-multiple";
export const ENTITIES_UPDATED = "atp-entity/updated-multiple";

const _updateEntity = (state, type, entity, idField) => o(state).merge({
    [type]: {
        [entity[idField]]: o(
            state[type] && state[type][entity[idField]] ? state[type][entity[idField]] : {}
        ).merge(entity, mergeFlags.NONE).raw
    }
}, mergeFlags.RECURSIVE).raw;

const _updateEntities = (state, type, entities, idField) => entities.reduce(
    (combined, entity) => _updateEntity(combined, type, entity, idField),
    state
);

const _deleteEntity = (state, type, id, idField) => o(state).merge({
    [type]: o(state[type]).filter(obj => obj[idField] !== id).raw
}, null).raw;

const _getChangedEntityIdList = (getState, type, results, idField) => [].concat(
    //Get entities that have not already been loaded
    a(results.map(entity => entity[idField])).difference(o(getState().entities[type]).keys).raw,

    ///Get entities that have already been loaded, but have a higher version
    results.filter(entity => o(getEntity(getState(), type, entity[idField])).as(existingEntity =>
        typeof existingEntity !== 'undefined' && entity.version > existingEntity.version
    )).map(entity => entity[idField])
);  //Note:  No need to check for duplicates since these two lists are mutually exclusive

//Initial state
const initialState = {
};

//Reducer
export default (state = initialState, action) =>
    o(action.type).switch({
        [UPDATE_ENTITY]:      () => _updateEntity(state, action.entityType, action.entity, action.idField),
        [DELETE_ENTITY]:      () => _deleteEntity(state, action.entityType, action.id, action.idField),
        [UPDATE_ENTITIES]:    () => _updateEntities(state, action.entityType, action.entities, action.idField),
        default: () => state
    });

//Selectors
export const getEntity = (getState, type, id) =>
    id && getState().entities[type] && getState().entities[type][id]
        ? getState().entities[type][id]
        : undefined;
export const getAllEntities = (getState, type) => getState().entities[type] || {};
export const getEntitiesById = (getState, type, idList) => idList.map(id => getEntity(getState, type, id));

//Action creators
export const updateEntity = (entityType, entity, idField) => ({type: UPDATE_ENTITY, entityType, idField, entity});
export const entityUpdated = (entityType, entity, idField) => ({type: ENTITY_UPDATED, entityType, idField, entity});
export const deleteEntity = (entityType, id, idField) => ({type: DELETE_ENTITY, entityType, id, idField});
export const entityDeleted = (entityType, id, idField) => ({type: ENTITY_DELETED, entityType, id, idField});
export const updateEntities = (entityType, entities, idField) => ({type: UPDATE_ENTITIES, entityType, idField, entities});
export const entitiesUpdated = (entityType, entities, idField) => ({type: ENTITIES_UPDATED, entityType, idField, entities});

//Boilerplate
export const entityBoilerplate = (type, endPoint, idField = "id") => ({
    select: {
        one: (getState, id) => getEntity(getState, type, id),
        all:  (getState) => o(getAllEntities(getState, type)).values(),
        some: (getState, filter = () => true) => o(getAllEntities(getState, type))
            .values()
            .filter(filter),
        byIdList: (getState, idList) => getEntitiesById(getState, type, idList),
    },
    action: {
        type: {
            update: "atp-entity/update/" + type,
            updated: "atp-entity/updated/" + type,
            delete: "atp-entity/delete/" + type,
            deleted: "atp-entity/deleted/" + type,
            updateMultiple: "atp-entity/update-multiple/" + type,
            updatedMultiple: "atp-entity/updated-multiple/" + type
        },
        update: entity => updateEntity(type, entity, idField),
        updateMultiple: entities => updateEntities(type, entities, idField),
        list: ({filters = {}, onIdLoad = ids => {}, onEntityLoad = entities => {}}) => rest()
            .get(endPoint)
            //Just get id and version at first
            .send(o(filters).merge({columns: "version," + idField}).raw)
            .then(([data, dispatch, getState]) => {
                const idsToUpdate = _getChangedEntityIdList(getState, type, data.results, idField);
                if(idsToUpdate.length > 0) {
                    dispatch(rest()
                        .get(endPoint)
                        .send(o(filters)
                            .filter((_, key) => key === 'columns')
                            .merge({[idField]: idsToUpdate.join(',')})
                        )
                        .then(([data, dispatch]) => {
                            dispatch(updateEntities(type, data.results, idField));
                            onEntityLoad(dispatch, data.results);
                        })
                        .thunk()
                    );
                }
                onIdLoad(dispatch, data.results.map(entity => entity[idField]));
            })
            .thunk(),
        get: (id, callback = () => {}) => rest()
            .get(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, data.results, idField));
                callback(data, dispatch, getState);
            })
            .thunk(),
        post: (entity, callback = () => {}) => rest()
            .post(endPoint)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, entity, idField));
                dispatch(entityUpdated(type, entity, idField));
                callback(data, dispatch, getState);
            })
            .send(entity)
            .thunk(),
        put: (id, entity, callback = () => {}) => rest()
            .put(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, entity, idField));
                dispatch(entityUpdated(type, entity, idField));
                callback(data, dispatch, getState);
            })
            .send(entity)
            .thunk(),
        patch: (id, entity, callback = () => {}) => rest()
            .patch(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(updateEntity(type, entity, idField));
                dispatch(entityUpdated(type, entity, idField));
                callback(data, dispatch, getState);
            })
            .send(entity)
            .thunk(),
        delete: (id, callback = () => {}) => rest()
            .delete(endPoint + "/" + id)
            .then(([data, dispatch, getState]) => {
                dispatch(deleteEntity(type, id, idField));
                dispatch(entityDeleted(type, id, idField));
                callback(data, dispatch, getState);
            })
            .thunk()
    }
});

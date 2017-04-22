/**
 * Created by Andy on 3/27/2017.
 */

import {mergeFlags} from "atp-sugar";
import {o, mergeFlags} from "atp-sugar";
import rest from "atp-rest";

export const UPDATE_ENTITY = "atp-entity/update";
export const DELETE_ENTITY = "atp-entity/delete";
export const UPDATE_ENTITIES = "atp-entity/update-multiple";
export const UPDATE_ENTITY_LIST = "atp-entity/update-list";

const _updateEntity = (state, type, entity) => o(state).merge({
    [type]: {
        [entity.id]: o(
            state[type] && state[type][entity.id] ? state[type][entity.id] : {}
        ).merge(entity, mergeFlags.NONE).raw
    }
}, mergeFlags.RECURSIVE).raw;

const _updateEntities = (state, type, entities) => entities.reduce(
    (combined, entity) => _updateEntity(combined, type, entity),
    state
);

const listKey = (type, filters) => type + JSON.stringify(filters);

//Initial state
const initialState = {
    lists: {}
};

//Reducer
export default (state = initialState, action) =>
    o(action.type).switch({
        [UPDATE_ENTITY]:      () => _updateEntity(state, action.entityType, action.entity),
        [DELETE_ENTITY]:      () => state, //TODO:  Implement
        [UPDATE_ENTITIES]:    () => _updateEntities(state, action.entityType, action.entities),
        [UPDATE_ENTITY_LIST]: () => o(_updateEntities(state, action.entityType, action.entities)).merge({
                lists: {
                    [action.key]: action.entities.map(entity => entity.id)
                }
            }, mergeFlags.RECURSIVE).raw,
        default: () => state
    });

//Selectors
export const getEntity = (state, type, id) => id && state.entities[type] && state.entities[type][id] ? state.entities[type][id] : undefined;
export const getAllEntities = (state, type) => state.entities[type] || {};
export const getEntityList = (state, type, key) => state.entities.lists[key]
    ? state.entities.lists[key].map(id => getEntity(state, type, id))
    : [];
export const getEntitiesById = (state, type, idList) => idList.map(id => getEntity(state, type, id));

//Action creators
export const updateEntity = (entityType, entity) => ({type: UPDATE_ENTITY, entityType, entity});
export const deleteEntity = (entityType, id) => ({type: DELETE_ENTITY, entityType, id});
export const updateEntities = (entityType, entities) => ({type: UPDATE_ENTITIES, entityType, entities});
export const updateEntityList = (entityType, key, entities) => ({type: UPDATE_ENTITY_LIST, entityType, key, entities});

//Boilerplate
export const entityBoilerplate = (type, endPoint) => ({
    selector: {
        single: (state, id) => getEntity(state, type, id),
        list: (state, filters) => getEntityList(state, type, listKey(type, filters)),
        listById: (state, idList) => getEntitiesById(state, type, idList),
    },
    action: {
        update: {
            single: entity => updateEntity(type, entity),
            multiple: entities => updateEntities(type, entities),
            list: (filters, entities) => updateEntityList(type, listKey(type, filters), entities),
        },
        list: filters => rest()
            .get(endPoint)
            .then((data, dispatch) => dispatch(updateEntityList(type, listKey(type, filters), data.results)))
            .send(filters)
            .thunk(),
        get: id => rest()
            .get(endPoint + "/" + id)
            .then((data, dispatch) => dispatch(updateEntity(type, data.results)))
            .thunk(),
        post: entity => rest()
            .post(endPoint)
            .then((data, dispatch) => dispatch(updateEntity(type, entity)))
            .send(entity)
            .thunk(),
        put: entity => rest()
            .put(endPoint + "/" + entity.id)
            .then((data, dispatch) => dispatch(updateEntity(type, entity)))
            .send(entity)
            .thunk(),
        patch: entity => rest()
            .patch(endPoint + "/" + entity.id)
            .then((data, dispatch) => dispatch(updateEntity(type, entity)))
            .send(entity)
            .thunk(),
        delete: id => rest()
            .delete(endPoint + "/" + id)
            .then(dispatch => dispatch(deleteEntity(type, id)))
            .thunk()
    }
});

export const relatedEntityBoilerplate = (type, endPoint) => {
    const listAction = filters => rest()
        .get(endPoint)
        .then((data, dispatch) => dispatch(updateEntityList(type, listKey(endPoint, filters), data.results)))
        .send(filters)
        .thunk();

    return {
        selector: {
            list: (state, filters) => getEntityList(state, type, listKey(endPoint, filters)),
        },
        action: {
            list: listAction,
            post: id => rest()
                .post(endPoint)
                .then((data, dispatch) => dispatch(listAction))
                .send({id})
                .thunk(),
            delete: id => rest()
                .delete(endPoint + "/" + id)
                .then((data, dispatch) => dispatch(listAction))
                .thunk()
        }
    }
}

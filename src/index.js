
import entities from "./reducer/entities";
import {
    entityBoilerplate,
    updateEntity, updateEntities, entityUpdated, entitiesUpdated,
    getEntity, getEntitiesById, getAllEntities
} from "./reducer/entities";

export default {
    reducers: {
        entities
    }
};

export {
    entityBoilerplate,
    updateEntity, updateEntities, entityUpdated, entitiesUpdated,
    getEntity, getEntitiesById, getAllEntities
};
/**
 * Created by Andy on 3/27/2017.
 */

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
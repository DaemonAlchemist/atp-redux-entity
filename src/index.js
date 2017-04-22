/**
 * Created by Andy on 3/27/2017.
 */

import entities from "./reducer/entities";
import {
    entityBoilerplate, relatedEntityBoilerplate,
    updateEntity, updateEntities, updateEntityList,
    getEntity, getEntityList, getEntitiesById, getAllEntities
} from "./reducer/entities";

export default {
    reducers: {
        entities
    }
};

export {
    entityBoilerplate, relatedEntityBoilerplate,
    updateEntity, updateEntities, updateEntityList,
    getEntity, getEntityList, getEntitiesById, getAllEntities
};
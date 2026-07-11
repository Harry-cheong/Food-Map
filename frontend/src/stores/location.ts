import {defineStore} from 'pinia'
import {ref} from "vue"
import { useApi } from '../composables/useApi'

class Place {
    name: string
    coordinates: any
    location: string
    marker: any
    id?: number
    category: string
    description: string

    constructor(name: string, location: string, coordinates: any, marker: any, category: string, description: string, id?: number) {
        this.name = name
        this.coordinates = coordinates
        this.location = location
        this.marker = marker
        this.id = id
        this.category = category
        this.description = description
    }
}

class ItemRequest {
    name: string
    lat: number
    lng: number
    location: string
    category: string
    description: string
    public: boolean

    constructor(name: string, location: string,lat: number, lng: number, category: string, description: string, allowPublic: boolean) {
        this.name = name
        this.location = location
        this.lat = lat
        this.lng = lng
        this.category = category
        this.description = description
        this.public = allowPublic
    }
}


interface ItemResponse {
    name: string
    lat: number
    lng: number
    location: string
    category: string
    description: string
    public: boolean
    id: number
    submitted_by_user_id: number
    created_at: string
}

export const useLocationStore = defineStore('loc', ()=>{
    const places = ref(new Array<Place>)
    const selected = ref<Place | null>(null)

    // Updates
    function addSavedPlaces(place: Place) {
        places.value.push(place)
    }

    async function addNewPlace(place: Place) {
        const {data, execute} = useApi<ItemResponse>('/items', {method: "POST"})
        const item = new ItemRequest(place.name, place.location, place.coordinates.lat, place.coordinates.lng, place.category, place.description, true);
        console.log(item);
        await execute(item) 

        if (data.value) {
            console.log(data);
            place.id = data.value?.id
        } else {
            console.log("Fail to reach backend");
        }
        places.value.push(place)
        console.log(places);
    }

    async function deletePlace(place:Place) {
        console.log(place);
        place.marker.remove()
        const index = places.value.findIndex(m => m === place)
        const {execute} = useApi(`/delete/${place.id}`, {method: "DELETE"})
        await execute()
        if (index != -1) {
            places.value.splice(index, 1)
        }
    }

    function selectPlace(place:Place) {
        selected.value = place
    }

    return {places, selected, addNewPlace, addSavedPlaces, deletePlace, selectPlace}
})
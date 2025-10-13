import { ObjectId } from "mongodb";
import { normalizationJob } from "../batch/normalization/normalization";

function isId(id: string): boolean {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id 
}

function rawIdsToNormalize(ids: ObjectId[]) {
    return {
        _id: { $in: ids }
    }
}

function main() {
    const [_, ...ids] = process.argv
    const objectIds = ids.filter(isId).map(_ => new ObjectId(_))
    const query = rawIdsToNormalize(objectIds)
    return normalizationJob(query)
}

main().then(console.log).catch(console.error)

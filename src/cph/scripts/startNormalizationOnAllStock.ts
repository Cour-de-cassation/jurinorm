import { disconnect } from "../library/DbRawFile";
import { normalizeRawCphFiles } from "../service/cph/handler";

normalizeRawCphFiles({ events: { $not: { $elemMatch: { type: "normalized" } } } })
.finally(() => { setTimeout(disconnect, 3000) }) // probably useless to wait - just in case
import { createServer } from 'http';
import fs from 'fs';

function allowAllAnonymousAccess(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');
}
function accessControlConfig(req, res) {
    if (req.headers['sec-fetch-mode'] == 'cors') {
        allowAllAnonymousAccess(res);
        console.log("Client browser CORS check request");
    }
}
function CORS_Preflight(req, res) {
    if (req.method === 'OPTIONS') {
        res.end();
        console.log("Client browser CORS preflight check request");
        return true;
    }
    return false;
}
function extract_Id_From_Request(req) {
    // .../api/ressources/id
    let parts = req.url.split('/');
    return parseInt(parts[parts.length - 1]);
}
function validateBookmark(bookmark) {
    if (!('Title' in bookmark)) return 'Title is missing';
    if (!('Url' in bookmark)) return 'Url is missing';
    if (!('Category' in bookmark)) return 'Category is missing';
    return '';
}
async function handleBookmarksServiceRequest(req, res) {
    if (req.url.includes("/api/bookmarks")) {
        const bookmarksFilePath = "./bookmarks.json";
        let bookmarksJSON = fs.readFileSync(bookmarksFilePath);
        let bookmarks = JSON.parse(bookmarksJSON);
        let validStatus = '';
        let id = extract_Id_From_Request(req);
        switch (req.method) {
            case 'GET':
                if (isNaN(id)) {
                    res.writeHead(200, { 'content-type': 'application/json' });
                    res.end(bookmarksJSON);
                } else {
                    let found = false;
                    for (let bookmark of bookmarks) {
                        if (bookmark.Id === id) {
                            found = true;
                            res.writeHead(200, { 'content-type': 'application/json' });
                            res.end(JSON.stringify(bookmark));
                            break;
                        }
                    }
                    if (!found) {
                        res.writeHead(404);
                        res.end(`Error : The bookmark of id ${id} does not exist`);
                    }
                }
                break;
            case 'POST':
                let newBookmark = await getPayload(req);
                validStatus = validateBookmark(newBookmark);
                if (validStatus == '') {
                    let maxId = 0;
                    bookmarks.forEach(bookmark => {
                        if (bookmark.Id > maxId)
                            maxId = bookmark.Id;
                    });
                    newBookmark.Id = maxId + 1;
                    bookmarks.push(newBookmark);
                    fs.writeFileSync(bookmarksFilePath, JSON.stringify(bookmarks));
                    res.writeHead(201, { 'content-type': 'application/json' });
                    res.end(JSON.stringify(newBookmark));
                } else {
                    res.writeHead(400);
                    res.end(`Error: ${validStatus}`);
                }
                break;
            case 'PUT':
                let modifiedBookmark = await getPayload(req);
                validStatus = validateBookmark(modifiedBookmark);
                if (validStatus == '') {
                    if (!isNaN(id)) {
                        if (!('Id' in modifiedBookmark)) modifiedBookmark.Id = id;
                        if (modifiedBookmark.Id == id) {
                            let storedBookmark = null;
                            for (let bookmark of bookmarks) {
                                if (bookmark.Id === id) {
                                    storedBookmark = bookmark;
                                    break;
                                }
                            }
                            if (storedBookmark != null) {
                                storedBookmark.Title = modifiedBookmark.Title;
                                storedBookmark.Url = modifiedBookmark.Url;
                                storedBookmark.Category = modifiedBookmark.Category;
                                fs.writeFileSync(bookmarksFilePath, JSON.stringify(bookmarks));
                                res.writeHead(200);
                                res.end();
                            } else {
                                res.writeHead(404);
                                res.end(`Error: The bookmark of id ${id} does not exist.`);
                            }
                        } else {
                            res.writeHead(409);
                            res.end(`Error: Conflict of id`);
                        }
                    } else {
                        res.writeHead(400);
                        res.end("Error : You must provide the id of bookmark to modify.");
                    }
                } else {
                    res.writeHead(400);
                    res.end(`Error: ${validStatus}`);
                }
                break;
            case 'DELETE':
                if (!isNaN(id)) {
                    let index = 0;
                    let oneDeleted = false;
                    for (let bookmark of bookmarks) {
                        if (bookmark.Id === id) {
                            bookmarks.splice(index, 1);
                            fs.writeFileSync(bookmarksFilePath, JSON.stringify(bookmarks));
                            oneDeleted = true;
                            break;
                        }
                        index++;
                    }
                    if (oneDeleted) {
                        res.writeHead(204); // success no content
                        res.end();
                    } else {
                        res.writeHead(404);
                        res.end(`Error: The bookmark of id ${id} does not exist.`);
                    }
                } else {
                    res.writeHead(400);
                    res.end("Error : You must provide the id of bookmark to delete.");
                }
                break;
            case 'PATCH':
                res.writeHead(501);
                res.end("Error: The endpoint PATCH api/bookmarks is not implemented.");
                break;
        }
        return true;
    }
    return false;
}

function handleRequest(req, res) {
    return handleBookmarksServiceRequest(req, res);
}

function getPayload(req) {
    return new Promise(resolve => {
        let body = [];
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            if (body.length > 0)
                if (req.headers['content-type'] == "application/json")
                    try { resolve(JSON.parse(body)); }
                    catch (error) { console.log(error); }
            resolve(null);
        });
    })
}

const server = createServer(async (req, res) => {
    console.log(req.method, req.url);
    accessControlConfig(req, res);
    if (!CORS_Preflight(req, res))
        if (!handleRequest(req, res)) {
            res.writeHead(404);
            res.end();
        }
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


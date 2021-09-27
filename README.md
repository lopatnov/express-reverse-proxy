# Express reverse proxy

A back-end (Node.js) development tool to serve front-end projects with back-end reverse proxy for API. Configure a tool and serve your front-end projects.

- [Run Server through NPM](#run-server-through-npm)
- [Run Server through Docker](#run-server-through-docker)
- [Configuration](#configuration)
- [Configuration Recipes](#configuration-recipes)
- [Rights and Agreements](#rights-and-agreements)

## Run Server through NPM

```bash
npm start
```

[![Patreon](https://img.shields.io/badge/Donate-Patreon-informational)](https://www.patreon.com/lopatnov)
[![sobe.ru](https://img.shields.io/static/v1?label=sobe.ru&message=%D0%91%D0%BB%D0%B0%D0%B3%D0%BE%D0%B4%D0%B0%D1%80%D0%BD%D0%BE%D1%81%D1%82%D1%8C&color=yellow&logo=data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAArlBMVEUAAAD//////////////////////////////////////////////////////////////////PP/3l7/9c//0yb/zAD/6ZP/zQf/++7/3FD/88X/0h7//v7/5oX/zATUqQDktgD/5HjQpgAFBACQcwD/zw/fsgCOcQD6yADZrQD2xAD8yQDnuADxwADcsADbrwDpugD3xQD5xwDjtQDywQD+ywD9ygDvvwD7yAD/1jRaObVGAAAAEHRSTlMAA3zg707pEJP8MMUBYN5fiwXJMQAAAAFiS0dEAf8CLd4AAAAHdElNRQflBgMAAxO4O2jCAAAAuElEQVQoz42S1w7CMAxFS8ueYZgNLZuyRynw/z9GdtxIkbgPceQT6Tq2vZwfEKx8wRPyiaViSYDABqQsAMq0OzxUqhbo9kBcavUM6A9AAtJAYDgC0ID7i+t4AghwfxanszlAGBnA/Flc0MfL1doA5s/ChoLtbg8QI392gpIBzf/AwYAWAsdTrIE05/nz5Xq7S6DKpenHM0pe+o/qg5Am74/0ybTkm+q6wG4iltV2LTko52idy+Banx9RYiS6Vrsc3AAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMS0wNi0wM1QwMDowMzoxOCswMDowMLvSSCkAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjEtMDYtMDNUMDA6MDM6MTgrMDA6MDDKj/CVAAAAAElFTkSuQmCC)](https://sobe.ru/na/tech_knigi)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-lopatnov-informational?style=social&logo=linkedin)](https://www.linkedin.com/in/lopatnov/)

## Run Server through Docker

```bash
docker build -t lopatnov/server .
docker run -p 8080:8080 lopatnov/server
```

## Configuration

Edit `server-config.json` file

![run process](./www/assets/img/process.png)

### Configure server port

```json
{
  "port": 8080
  ...
}
```

To configure server port, edit `port` variable. The default server port is `8080`.

### Configure `folders` variable

The `folders` is a variable to serve static files such as images, CSS files, and JavaScript files.

#### Serve static files from a single directory

```json
{
  "folders": "www"
}
```

This configuration means that the server will serve static files from a local `www` directory. The `folders` variable can changed by a value of relative path like "./www", "../../my-nice-project/www" or "./project/my-front-end-files".

#### Serve static files from multiple directories

```json
{
  "folders": ["./www", "./mock-json", "../../images"]
}
```

This configuration means that the server will serve static files from multiple directories:

- `./www`
- `./mock-json`
- `../../images`

#### Map url path to serve static files from directories

```json
{
  "folders": {
    "/": "dist",
    "/api": "./mock-json",
    "/assets": {
      "/images": "./images",
      "/css": "./scss/dist",
      "/script": "./scripts"
    }
  }
}
```

This configuration means that the server will serve static files from multiple directories. The url path maps to this directories.

In example above you can see the next mapping:

```txt
url: /
directory: dist

url: /api
directory: ./mock-json

url: /assets/images
directory: ./images

url: /assets/css
directory: ./scss/dist

url: /assets/script
directory: ./scripts
```

### Configure `proxy` variable

The `proxy` variable intended for request redirect to 3rd-party server and getting result of this response.

#### Connect API to front-end project

```json
{
  "port": 4200,
  "folders": "www",
  "proxy": {
    "/api": "localhost:8000"
  }
}
```

This configuration means that the server will serve static files from a local `www` directory on 4200 port with remote API on <http://localhost:8000>. When the web-site makes request to "/api" path, the request will redirect to remote server with <localhost:8000> address.

### Configure `unhandled` variable

To handle unhandled requests use `unhandled` variable. It's behavior depends on Accept header. It can be used any accept header.

```json5
{
  ...
  "unhandled": {
    "html": { // <-- Accept header for html requests
      ...
    },
    "json": { // <-- Accept header for json requests
      ...
    },
    "xml": { // <-- Accept header for xml requests
      ...
    },
    "*": { // <-- Any accept header
      ...
    }
  }
  ...
}
```

Each accept header can contain its options.

```json5
"html": { // <-- Accept header for HTML requests (for example)
  "status": 307, // <-- Response status code Temporary redirect, see 307 http status code
  "headers": {  // <-- Headers
    "Location": "/"
  }
},

"json": { // <-- Accept header for json requests
  "status": 404, // <-- Response status code Not Found
  "send": { // Response JSON object
    "error": "JSON Not Found"
  }
},

"xml": { // <-- Accept header for XML requests
  "status": 404, // <-- Response status code Not Found
  "send": "<error>Not Found</error>" // Response is text
},

"*": { // <-- Any accept header
  "status": 404,  // <-- Response status code Not Found
  "file": "./www/not-found.txt" // Response read from file "./www/not-found.txt"
}
```

## Configuration Recipes

### Request a static file, than make request to back-end

Server listening in 8080 port

- Request --> Search static file in "www" folder --> File found --> Response is the file
- Request --> Search static file in "www" folder --> File not found --> Make request to back-end <http://localhost:4000/current-path> --> Response from the back-end

```json
{
  "port": 8080,
  "folders": "www",
  "proxy": "localhost:4000"
}
```

### Request API by path that starts as `/api`, otherwise request front-end by default

Server listening in 8080 port

- Request --> Search static file in "www" folder --> File found --> Response is the file
- Request --> Search static file in "www" folder --> File not found --> Response 404 Not Found
- Request /api/current-path --> Make request to back-end <http://localhost:4000/current-path> --> Response from the back-end

```json
{
  "port": 8080,
  "folders": "www",
  "proxy": {
    "/api": "localhost:4000"
  }
}
```

## Rights and Agreements

License [Apache-2.0](https://github.com/lopatnov/static-server-express/blob/master/LICENSE)

Copyright 2020–2021 Oleksandr Lopatnov

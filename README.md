# Express reverse proxy

[![Patreon](https://img.shields.io/badge/Donate-Patreon-informational)](https://www.patreon.com/lopatnov)
[![sobe.ru](https://img.shields.io/static/v1?label=sobe.ru&message=%D0%91%D0%BB%D0%B0%D0%B3%D0%BE%D0%B4%D0%B0%D1%80%D0%BD%D0%BE%D1%81%D1%82%D1%8C&color=yellow&logo=data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAArlBMVEUAAAD//////////////////////////////////////////////////////////////////PP/3l7/9c//0yb/zAD/6ZP/zQf/++7/3FD/88X/0h7//v7/5oX/zATUqQDktgD/5HjQpgAFBACQcwD/zw/fsgCOcQD6yADZrQD2xAD8yQDnuADxwADcsADbrwDpugD3xQD5xwDjtQDywQD+ywD9ygDvvwD7yAD/1jRaObVGAAAAEHRSTlMAA3zg707pEJP8MMUBYN5fiwXJMQAAAAFiS0dEAf8CLd4AAAAHdElNRQflBgMAAxO4O2jCAAAAuElEQVQoz42S1w7CMAxFS8ueYZgNLZuyRynw/z9GdtxIkbgPceQT6Tq2vZwfEKx8wRPyiaViSYDABqQsAMq0OzxUqhbo9kBcavUM6A9AAtJAYDgC0ID7i+t4AghwfxanszlAGBnA/Flc0MfL1doA5s/ChoLtbg8QI392gpIBzf/AwYAWAsdTrIE05/nz5Xq7S6DKpenHM0pe+o/qg5Am74/0ybTkm+q6wG4iltV2LTko52idy+Banx9RYiS6Vrsc3AAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMS0wNi0wM1QwMDowMzoxOCswMDowMLvSSCkAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjEtMDYtMDNUMDA6MDM6MTgrMDA6MDDKj/CVAAAAAElFTkSuQmCC)](https://sobe.ru/na/tech_knigi)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-lopatnov-informational?style=social&logo=linkedin)](https://www.linkedin.com/in/lopatnov/)

A back-end (Node.js) development tool to serve front-end projects with back-end reverse proxy for API. Configure a tool and serve your front-end projects.

- [Run Server](#run-server)
- [Docker support](#docker-support)
- [Configuration](#configuration)
- [Rights and Agreements](#rights-and-agreements)

## Run Server

> npm start

The server is listening on <http://localhost:8080>

## Docker support

```
> docker build -t lopatnov/server .
> docker run -p 8080:8080 lopatnov/server
```

## Configuration

Edit `server-config.json` file

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

## Rights and Agreements

License [Apache-2.0](https://github.com/lopatnov/static-server-express/blob/master/LICENSE)

Copyright 2020–2021 Oleksandr Lopatnov

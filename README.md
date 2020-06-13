# static-server-express

## Run Server

> npm start

## Configuration

Edit `config.json` file

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
    "": "dist",
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

## Docker support

> docker build .

> docker run -p 8080:8080 <id>

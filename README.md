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

This configuration means that server will serve static files from a local `www` directory.

## Docker support

> docker build .

> docker run -p 8080:8080 <id>

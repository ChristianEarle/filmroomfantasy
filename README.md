
  # Fantasy Football Web App

  This is a code bundle for Fantasy Football Web App. The original project is available at https://www.figma.com/design/XxhTVYF80I7GCsfbhhgJBr/Fantasy-Football-Web-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Sleeper player data

  The app imports NFL player data from the [Sleeper API](https://docs.sleeper.com/). To sync players into the database:

  1. Start the API server: `cd server && npm run dev`
  2. In another terminal, run: `cd server && npm run sync:players`

  Or `POST` to `http://localhost:8787/api/admin/sync-players`. If `SYNC_SECRET` is set, include the header `X-Admin-Key: <your-secret>`.
  
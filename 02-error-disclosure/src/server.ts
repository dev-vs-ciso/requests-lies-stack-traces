import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`Patient portal listening on http://localhost:${port}`);
});

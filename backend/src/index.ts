import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`API demandeAchat à l'écoute sur http://localhost:${env.port}`);
});

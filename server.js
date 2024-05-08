const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Dit staat CORS toe voor alle domeinen op alle routes
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"], // Zorg dat dit overeenkomt met je behoeften
    credentials: true,
  },
});

app.use(cors()); // Hiermee sta je CORS toe voor alle Express routes
app.use(express.json());

// Houd een object bij voor het bijhouden van getoonde notificaties per gebruiker (socket ID)
const displayedNotifications = {};

io.on("connection", (socket) => {
  console.log("Nieuwe gebruiker verbonden");

  console.log("Socket ID:", socket.id);

  // Luister naar het 'userLocation' event verzonden vanaf de client
  socket.on("userLocation", async (data) => {
    const { websiteId, location } = data;
    if (!websiteId) {
      console.error("Website ID is missing");
      return;
    }
    console.log("Website ID:", websiteId, "op locatie:", location);

    try {
      // Vind de website met de gegeven ID en laad de relevante notificaties
      const websiteWithNotifications = await prisma.website.findUnique({
        where: {
          id: websiteId,
        },
        include: {
          notifications: {
            where: {
              page: location,
            },
          },
        },
      });

      // De variabele websiteWithNotifications bevat nu de website en alle bijbehorende notificaties voor de opgegeven locatie
      console.log(
        "Geladen notificaties:",
        websiteWithNotifications.notifications
      );

      // Stuur relevante notificaties naar de gebruiker met de forEach methode
      websiteWithNotifications.notifications.forEach((notification) => {
        const { id, imgUrl, sender, message, link, showTimeInMs, delayInMs } =
          notification;

        // Controleer of de notificatie al aan deze gebruiker is getoond tijdens deze sessie
        if (!displayedNotifications[socket.id]?.includes(id)) {
          // Stuur de notificatie naar de gebruiker
          socket.emit("notification", {
            imgUrl,
            sender,
            message,
            link,
            showTimeInMs,
            delayInMs,
          });

          // Voeg de ID van de getoonde notificatie toe aan het cache-object
          if (!displayedNotifications[socket.id]) {
            displayedNotifications[socket.id] = [id];
          } else {
            displayedNotifications[socket.id].push(id);
          }
        }
      });
    } catch (error) {
      console.error("Fout bij het ophalen van notificaties:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Gebruiker losgekoppeld");

    // Verwijder de cache van getoonde notificaties voor deze gebruiker bij het verbreken van de verbinding
    delete displayedNotifications[socket.id];
  });
});

server.listen(8080, () => {
  console.log("Server luistert op poort 8080");
});

const { Server } = require('socket.io');

const activeRooms = {};

function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    console.log('[Socket] User connected:', socket.id);

    // Host creates a room with selected questions
    socket.on('create_room', ({ roomId, user, questions }) => {
      activeRooms[roomId] = {
        id: roomId,
        host: socket.id,
        status: 'lobby',
        questions: questions || [],
        players: [{ id: socket.id, name: user.name, score: 0, completed: 0 }]
      };
      socket.join(roomId);
      console.log(`[Socket] Room created: ${roomId} by ${user.name}`);
      io.to(roomId).emit('room_updated', activeRooms[roomId]);
    });

    // Player joins existing room
    socket.on('join_room', ({ roomId, user }) => {
      const room = activeRooms[roomId];
      if (!room) return socket.emit('error', 'Room not found!');
      if (room.status !== 'lobby') return socket.emit('error', 'Game already started!');

      // Check if player already exists
      const existingPlayer = room.players.find(p => p.name === user.name);
      if (!existingPlayer) {
          room.players.push({ id: socket.id, name: user.name, score: 0, completed: 0 });
      }

      socket.join(roomId);
      io.to(roomId).emit('room_updated', room);
      socket.to(roomId).emit('user_joined', { message: `${user.name} has joined the arena!` });
    });

    // Host starts game
    socket.on('start_game', (roomId) => {
      const room = activeRooms[roomId];
      if (room && room.host === socket.id) {
        room.status = 'playing';
        io.to(roomId).emit('game_started', room);
      }
    });

    socket.on('code_change', ({ roomId, code }) => {
      socket.to(roomId).emit('code_update', code);
    });

    socket.on('language_change', ({ roomId, language }) => {
      socket.to(roomId).emit('language_update', language);
    });
    
    // Auto-grading updates score
    socket.on('submit_success', ({ roomId, points }) => {
       const room = activeRooms[roomId];
       if (room) {
           const player = room.players.find(p => p.id === socket.id);
           if (player) {
               player.score += points;
               player.completed += 1;
               io.to(roomId).emit('leaderboard_updated', room.players);
               
               if (player.completed >= room.questions.length && room.questions.length > 0) {
                   room.status = 'finished';
                   io.to(roomId).emit('game_over', room.players);
               }
           }
       }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] User disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = initSocket;

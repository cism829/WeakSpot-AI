var client_id = Math.floor(Math.random() * 15) + 1;
document.querySelector("#ws-id").textContent = client_id;

var ws; // WebSocket will be created when user joins a room

function joinRoom(room) {
    if (!room) return;

    // Connect to the backend with the room in the URL
    ws = new WebSocket(`ws://localhost:8000/ws/${room}/${client_id}`);

    ws.onmessage = function(event) {
        var messages = document.getElementById('messages');
        var message = document.createElement('p');
        if (event.data.startsWith("You:")) {
            message.classList.add('user');
        } else if (event.data.includes('entered') || event.data.includes('left')) {
            message.classList.add('notification');
        } else {
            message.classList.add('other');
        }
        message.textContent = event.data;
        messages.appendChild(message);
    }

    ws.onopen = function() {
        console.log(`Connected to room: ${room}`);
    }

    ws.onclose = function() {
        console.log(`Disconnected from room: ${room}`);
    }
}

function sendMessage(event) {
    event.preventDefault();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert("You must join a room first!");
        return;
    }
    var input = document.getElementById("messageText");
    ws.send(input.value);
    input.value = '';
}

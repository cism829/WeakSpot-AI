# Group Study Branch 

## How to Run 
have to have fastAPI websockets and all dependences (doing npm install should cover everything)

in one terminal open and run the front end with npm run dev. 

In another terminal, open and run uvicorn app.main:app --reload this handles the websokcet from the backend 

go to route /chat to view the chat box feature, use same route in different tab to chat between users. User ids are randomly generated. 
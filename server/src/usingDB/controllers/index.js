import db from '../db';
import UserModel from '../../models/model';
import jwt from 'jsonwebtoken';

const epicApp = {
    async createUser(req,res){
      // u need to do this cos row[0] cant be used outside await db.query
      let userData = [];
      // use $1 to refer to the first record in ur search
      const findOneEmail = 'SELECT * FROM users WHERE email=$1';
      const email = req.body.email;
      if(!email){
        return res.status(400).send({ message: 'email is required' });
      }
      if(email){
        try {
          const { rows } = await db.query(findOneEmail, [req.body.email]);
          userData = rows[0];
          if(userData) {
            return res.status(400).send({'message': 'email already exists'});
          }
        }
        finally{
          const validateEmail = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
        const result = validateEmail.test(email);
        const newVal = email.split('@');
        const finalCheck = newVal[1];
        if(!result || finalCheck !=="epic.com"){ 
          return res.status(400).send({ message: 'please enter a valid epic email' });
        }
        }
      }
      if(!req.body.firstName || req.body.firstName.length < 3){
        return res.status(400).send({ message: 'first name is required and has a minimum of 3 characters' });
      }
      if(!req.body.lastName || req.body.lastName.length < 3){
        return res.status(400).send({ message: 'last name is required and has a minimum of 3 characters' });
      }
      if(!req.body.password || req.body.password.length < 6){
        return res.status(400).send({ message: 'password is required and has a minimum of 6 characters' });
      }
      const hashedPassword = UserModel.hashPassword(req.body.password);
      // call req.body, destructure to get password and then save encrypt into password
      userData = {...req.body, password: hashedPassword};
      const text = `
      INSERT INTO users(email,first_name,last_name,password)
      VALUES($1,$2,$3,$4)
      returning *`;
      const values = [
        req.body.email,
        req.body.firstName,
        req.body.lastName,
        userData.password
      ];
      try {
        const { rows } = await db.query(text, values);
        let token = jwt.sign({ email: userData.email, id: userData.id },
          process.env.SECRET,
          { expiresIn: '24h' });     
      return res.status(201).send({
        status: 'success',
        data:
       {
         message: `Authentication successful!. Welcome ${req.body.firstName}`,
         token: token
       },
      });
        // return res.status(201).send(rows[0]);
      } catch(error) {
        return res.status(400).send(error);
      }
    },
    async login(req,res){
      let userData = [];
      const findOneEmail = 'SELECT * FROM users WHERE email=$1';
      if (!req.body.email || !req.body.password) {
        return res.status(400).send({ message: 'email and password are required' });
      }
      try {
        const { rows } = await db.query(findOneEmail, [req.body.email]);
        userData = rows[0];
        if(!userData) {
          return res.status(400).send({'message': 'email or password is incorrect'});
        }
      }
      finally{
        if (userData &&  !UserModel.comparePassword(userData.password, req.body.password)) {
          return res.status(400).send({ message: 'Username or password is incorrect' });
        }
        // eslint-disable-next-line prefer-const
        if(userData){
        let token = jwt.sign({ email: userData.email, id : userData.id },
          process.env.SECRET,
          { expiresIn: '24h' });
        return res.status(200).send({
          status: 'success',
          data:
          {
            token: token,
          },
        });
        }
      else {
        res.status(403).send({
          success: 'error',
          message: 'Incorrect username or password'
        });
      }
      }
    },
    async sendMessage(req,res){
      const email = req.body.email;
      // u need to do this cos row[0] cant be used outside await db.query
      let userData = [];
      // use $1 to refer to the first record in ur search
      const findOneEmail = 'SELECT * FROM users WHERE email=$1';
      if(!req.body.subject){
        return res.status(400).send({ message: 'A subject is required' });
      }
      if(!req.body.message){
        return res.status(400).send({ message: 'A message is required' });
      }
      if(!req.body.email){
        return res.status(400).send({ message: 'Email is required' });
      }
      //validate to ensure its a valid mail and its an epic mail
      const validateEmail = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
      const result = validateEmail.test(email);
      const newVal = email.split('@');
      const finalCheck = newVal[1];
      if(!result || finalCheck !=="epic.com"){ 
        return res.status(400).send({ message: 'please enter a valid epic email' });
      }
      //if it passes valid mail, confirm that the email exist
      if(req.body.email){
        try {
          const { rows } = await db.query(findOneEmail, [email]);
          userData = rows[0];
          if(!userData) {
            return res.status(400).send({'message': 'the email does not exist'});
          }
          if(userData.id === req.decodedMessage.id){
            return res.status(400).send({'message': 'you cannot send messages to yourself'});
          }
        }
        //insert new message into db
        finally{
          const text = `
        INSERT INTO messages(created_on,email,subject,message,status,sender,reciever,is_deleted,group_status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        returning *`;
        const values = [
            new Date(),
            req.body.email,
            req.body.subject,
            req.body.message,
            'unread',
            req.decodedMessage.id,
            userData.id,
            'false',
            'false'
        ];
        try {
            const { rows } = await db.query(text, values);
            return res.status(201).send(rows[0]);
          } catch(error) {
            return res.status(400).send(error);
          }
        }
    }
    },
    async getAllMessagesPerUser(req,res){
      let output = [];
      const messages = 'SELECT * FROM messages WHERE reciever=$1 AND is_deleted=$2';
      try {
        const { rows } = await db.query(messages, [req.decodedMessage.id,'false']);
        output = rows;
        if(!output) {
          return res.status(400).send({'message': 'you have no messages'});
        }
      }
      finally{
        return res.status(200).send(output);
      }

    },
    async getAMessage(req,res){
      let output = [];
      const messages = 'SELECT * FROM messages WHERE id=$1 AND reciever=$2 AND is_deleted=$3';
      const updatestatus = 'UPDATE messages SET status=$1 WHERE id=$2 returning *';
      try {
        const { rows } = await db.query(messages, [req.params.id,req.decodedMessage.id,'false']);
        output = rows[0];
        if(!output) {
          return res.status(400).send({'message': 'email cannot be found'});
        }
      }
      finally{
        if(output){
        const values = ['read',req.params.id];
        const response = await db.query(updatestatus, values);
        return res.status(200).send(response.rows[0]);
        }
      }
    },
    async getUnreadMessages(req,res){
      let output = [];
      const messages = 'SELECT * FROM messages WHERE reciever=$1 AND status=$2 AND is_deleted=$3';
        const { rows } = await db.query(messages, [req.decodedMessage.id,'unread','false']);
        output = rows;
        if(!output) {
          return res.status(400).send({'message': 'you have no unread messages'});
        }
        return res.status(200).send(output);
    },
    async getMessagesSentByAUser(req,res){
      let output = [];
      const messages = 'SELECT * FROM messages WHERE sender=$1';
        const { rows } = await db.query(messages, [req.decodedMessage.id]);
        output = rows;
        if(!output) {
          return res.status(400).send({'message': 'you have not sent any messages'});
        }
        return res.status(200).send(output);
    },
    async deleteAMessage(req,res){
      // let output = [];
      const messages = 'UPDATE messages SET is_deleted=$1 WHERE reciever=$2 AND id=$3 returning *';

      try {
        const { rows } = await db.query(messages, ['true',req.decodedMessage.id, req.params.id]);
        if(!rows[0]) {
          return res.status(404).send({'message': 'you cannot delete this message'});
        }
         return res.status(200).send({'message': 'the message has been deleted'});
        // if(!output) {
        //   return res.status(400).send({'message': 'email does not exist'});
        // }
      }

      catch(e){
        return res.status(400).send({'message': 'email does not exist'});
      }
    },
    async createGroup(req,res){
      let group = [];
      const checkGroup = 'SELECT * FROM groups WHERE group_email=$1';
      const groupEmail = req.body.groupEmail;
      if(!req.body.groupName || !req.body.groupEmail){
        return res.status(400).send({'message': 'please enter groupName or groupEmail'});
      }
      //validate to ensure its a valid mail and its an epic mail
      const validateEmail = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
      const result = validateEmail.test(groupEmail);
      const newVal = groupEmail.split('@');
      const finalCheck = newVal[1];
      if(!result || finalCheck !=="epic.com"){ 
        return res.status(400).send({ message: 'please enter a valid epic email' });
      }
      if(req.body.groupName || req.body.groupEmail){
      const { rows } = await db.query(checkGroup, [req.body.groupEmail]);
      group = rows[0];
      if(group){
        return res.status(400).send({'message': 'Group email already exists'});
      }}
      const text = `INSERT INTO groups(group_name,group_email,created_by)VALUES($1,$2,$3)`;
      const values = [
        req.body.groupName,
        req.body.groupEmail,
        req.decodedMessage.id
    ];
    const { rows } = await db.query(text, values);
    return res.status(201).send({
      status: 'success',
      message: `Email group created successfully`,
    });
    },

}
export default epicApp;
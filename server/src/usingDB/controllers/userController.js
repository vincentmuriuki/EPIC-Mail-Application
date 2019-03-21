/* eslint-disable consistent-return */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unsafe-finally */
/* eslint-disable no-useless-escape */
/* eslint-disable prefer-destructuring */
import jwt from 'jsonwebtoken';
import db from '../db';
import UserModel from '../../models/model';

class UserController {
  static async createUser(req, res) {
    let userData = [];
    if (!req.body.email || typeof req.body.email !== 'string') {
      return res.status(400).send({ message: 'A valid email is required' });
    }
    if (req.body.email) {
      const validateEmail = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;
      const result = validateEmail.test(req.body.email);
      const newVal = req.body.email.split('@');
      const finalCheck = newVal[1];
      if (!result || finalCheck !== 'epic.com') {
        return res.status(400).send({ message: 'please enter a valid epic email' });
      }
    }
    if (!req.body.firstName.trim() || typeof req.body.firstName !== 'string' || req.body.firstName.length < 3) {
      return res.status(400).send({ message: 'Please enter a valid input.first name is required and has a minimum of 3 characters' });
    }
    if (!req.body.lastName.trim() || typeof req.body.lastName !== 'string' || req.body.lastName.length < 3) {
      return res.status(400).send({ message: 'Please enter a valid input.last name is required and has a minimum of 3 characters' });
    }
    if (!req.body.password.trim() || typeof req.body.password !== 'string' || req.body.password.length < 6) {
      return res.status(400).send({ message: 'Please enter a valid input.password is required and has a minimum of 6 characters' });
    }
    const findOneEmail = 'SELECT * FROM users WHERE email=$1';
    const { email } = req.body;
    const lastName = req.body.lastName.replace(/\s/g, '');
    const password = req.body.password.trim();
    const firstName = req.body.firstName.trim();
    if (email) {
      const { rows } = await db.query(findOneEmail, [req.body.email.toLowerCase()]);
      userData = rows[0];
      if (userData) {
        return res.status(409).send({ message: 'email already exists' });
      }
    }
    const hashedPassword = UserModel.hashPassword(password);
    // call req.body, destructure to get password and then save encrypt into password
    userData = { ...req.body, password: hashedPassword };
    const text = `
          INSERT INTO users(email,first_name,last_name,password)
          VALUES($1,$2,$3,$4)
          returning *`;
    const values = [
      req.body.email.toLowerCase(),
      firstName,
      lastName,
      userData.password,
    ];
    try {
      const { rows } = await db.query(text, values);
      const token = jwt.sign({ email: userData.email, id: userData.id },
        process.env.SECRET,
        { expiresIn: '24h' });
      return res.status(201).send({
        status: 'success',
        data:
           {
             message: `Authentication successful!. Welcome ${firstName}`,
             token,
           },
      });
      // return res.status(201).send(rows[0]);
    } catch (error) {
      return res.status(500).send('something went wrong with your request');
    }
  }

  static async login(req, res) {
    let userData = [];
    const findOneEmail = 'SELECT * FROM users WHERE email=$1';
    if (!req.body.email || !req.body.password) {
      return res.status(400).send({ message: 'email and password are required' });
    }
    const { rows } = await db.query(findOneEmail, [req.body.email]);
    userData = rows[0];
    if (!userData) {
      return res.status(400).send({ message: 'email or password is incorrect' });
    }
    if (userData && !UserModel.comparePassword(userData.password, req.body.password)) {
      return res.status(400).send({ message: 'Username or password is incorrect' });
    }
    // eslint-disable-next-line prefer-const
    if (userData) {
      const token = jwt.sign({ email: userData.email, id: userData.id },
        process.env.SECRET,
        { expiresIn: '24h' });
      return res.status(200).send({
        status: 'success',
        data:
              {
                token,
              },
      });
    }

    res.status(403).send({
      success: 'error',
      message: 'Incorrect username or password',
    });
  }
}

export default UserController;

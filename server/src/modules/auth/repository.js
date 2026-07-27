import pool from '../../config/db.js';

export class AuthRepository {
  async findByEmail(email, client) {
    const db = client || pool;
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email.toLowerCase().trim()]);
    return result.rows[0] || null;
  }

  async findById(id, client) {
    const db = client || pool;
    const query = 'SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async createUser({ firstName, lastName, email, passwordHash, role }, client) {
    const db = client || pool;
    const query = `
      INSERT INTO users (first_name, last_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, first_name, last_name, email, role, created_at
    `;
    const values = [
      firstName.trim(),
      lastName.trim(),
      email.toLowerCase().trim(),
      passwordHash,
      role
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }
}

export default new AuthRepository();

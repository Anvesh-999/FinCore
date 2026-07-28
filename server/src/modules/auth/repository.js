import { User, Counter } from '../../database/models.js';

export class AuthRepository {
  formatUser(user) {
    if (!user) return null;
    return {
      id: user._id,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      password_hash: user.passwordHash,
      role: user.role,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  }

  async findByEmail(email) {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    return this.formatUser(user);
  }

  async findById(id) {
    const user = await User.findById(id).lean();
    return this.formatUser(user);
  }

  async createUser({ firstName, lastName, email, passwordHash, role }) {
    const nextId = await Counter.getNextSequence('users');
    const user = await User.create({
      _id: nextId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role
    });
    const formatted = this.formatUser(user.toObject());
    delete formatted.password_hash;
    return formatted;
  }
}

export default new AuthRepository();

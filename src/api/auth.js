import { supabase } from './supabaseClient';
import bcrypt from 'bcryptjs';

/**
 * Авторизация пользователя по логину и паролю.
 * Сравниваем хеш из таблицы accounts.
 */
export async function loginUser(login, password) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*, companies(*), students(*)')
    .eq('login', login)
    .single();

  if (error || !data) {
    throw new Error('Неверный логин или пароль');
  }

  const passwordMatch = await bcrypt.compare(password, data.password_hash);
  if (!passwordMatch) {
    throw new Error('Неверный логин или пароль');
  }

  return data;
}

/**
 * Хеширование пароля для сохранения в БД
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';

/** Token aleatorio criptográficamente seguro (256 bits, base64url). */
export const randomToken = () => crypto.randomBytes(32).toString('base64url');

/** Hash determinista para buscar tokens sin almacenarlos en claro. */
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const hashPassword = (password: string) => bcrypt.hash(password, config.security.bcryptCost);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

let dummyHash: Promise<string> | undefined;
/** Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe. */
export const getDummyHash = () => (dummyHash ??= hashPassword(randomToken()));

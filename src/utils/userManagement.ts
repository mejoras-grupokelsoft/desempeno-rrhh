// src/utils/userManagement.ts
import { supabase } from '../lib/supabaseClient';
import { logger } from './sanitize';

/**
 * Cambiar la contraseña de un usuario (solo admin)
 * Genera un token de reset y lo guarda en la BD
 */
export async function generatePasswordResetToken(userId: string): Promise<string | null> {
  try {
    // Generar token aleatorio
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 horas

    const { error } = await supabase
      .from('users')
      .update({
        password_reset_token: token,
        password_reset_expires: expiresAt,
      })
      .eq('id', userId);

    if (error) {
      logger.error('Error generating password reset token:', error);
      return null;
    }

    return token;
  } catch (err: any) {
    logger.error('Error in generatePasswordResetToken:', err);
    return null;
  }
}

/**
 * Cambiar el rol de un usuario
 */
export async function changeUserRole(userId: string, newRole: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        rol: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      logger.error('Error changing user role:', error);
      return false;
    }

    return true;
  } catch (err: any) {
    logger.error('Error in changeUserRole:', err);
    return false;
  }
}

/**
 * Cambiar el área de un usuario
 */
export async function changeUserArea(userId: string, areaId: string | null): Promise<boolean> {
  try {
    // Resolver el nombre del área para mantener sincronizado el campo de texto `area`
    let areaNombre: string | null = null;
    if (areaId) {
      const { data: areaData } = await supabase
        .from('areas')
        .select('nombre')
        .eq('id', areaId)
        .single();
      areaNombre = areaData?.nombre || null;
    }

    const { error } = await supabase
      .from('users')
      .update({
        area_id: areaId,
        area: areaNombre,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      logger.error('Error changing user area:', error);
      return false;
    }

    return true;
  } catch (err: any) {
    logger.error('Error in changeUserArea:', err);
    return false;
  }
}

/**
 * Cambiar contraseña directamente en Supabase Auth
 * NOTA: Esto requiere acceso a la Admin API de Supabase
 * Por ahora, usamos el método de reset token
 */
export async function changeUserPassword(_email: string, _newPassword: string): Promise<boolean> {
  try {
    // Esto requeriría un endpoint custom o la Admin API
    // Por ahora retornamos false y usamos el método de reset token
    logger.warn('Direct password change not implemented. Use password reset token instead.');
    return false;
  } catch (err: any) {
    logger.error('Error in changeUserPassword:', err);
    return false;
  }
}

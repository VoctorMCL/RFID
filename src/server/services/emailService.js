// ===================================================================
// Servicio de correo electrónico para alertas de seguridad
// ===================================================================
const nodemailer = require('nodemailer');

/**
 * Crea el transportador de correo con la configuración SMTP
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Envía un correo electrónico de alerta de seguridad
 * @param {object} alert - Datos de la alerta
 * @param {string} alert.sensor_type - Tipo de sensor
 * @param {string} alert.severity - Severidad (low, medium, high, critical)
 * @param {string} alert.message - Mensaje descriptivo
 * @param {string} [alert.room_name] - Nombre de la sala
 * @param {string} [alert.door_name] - Nombre de la puerta
 */
const sendAlertEmail = async (alert) => {
  // Si no hay configuración SMTP, solo registrar en consola
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('📧 [Email no configurado] Alerta:', alert.message);
    return { sent: false, reason: 'SMTP no configurado' };
  }

  try {
    const transporter = createTransporter();

    const severityEmojis = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨',
    };

    const emoji = severityEmojis[alert.severity] || '⚠️';

    const mailOptions = {
      from: `"Control de Acceso Institucional" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL,
      subject: `${emoji} Alerta de Seguridad [${alert.severity.toUpperCase()}]: ${alert.sensor_type}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #18181b; color: white; padding: 20px; text-align: center;">
            <h1>🔒 Alerta de Seguridad — Control de Acceso RFID</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #ddd;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Severidad:</td>
                <td style="padding: 8px;">${emoji} ${alert.severity.toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Tipo de sensor:</td>
                <td style="padding: 8px;">${alert.sensor_type}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Mensaje:</td>
                <td style="padding: 8px;">${alert.message}</td>
              </tr>
              ${alert.room_name ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">Sala:</td>
                <td style="padding: 8px;">${alert.room_name}</td>
              </tr>` : ''}
              ${alert.door_name ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">Puerta:</td>
                <td style="padding: 8px;">${alert.door_name}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 8px; font-weight: bold;">Fecha/Hora:</td>
                <td style="padding: 8px;">${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
              </tr>
            </table>
          </div>
          <div style="background: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666;">
            Corporación Universitaria Lasallista — Control de Acceso
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Correo de alerta enviado:', info.messageId);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Error al enviar correo de alerta:', err.message);
    return { sent: false, reason: err.message };
  }
};

module.exports = { sendAlertEmail };

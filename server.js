import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const {
  JWT_SECRET = 'devsecret',
  ADMIN_EMAIL = 'admin@example.com',
  ADMIN_PASSWORD = 'password123',
  NODE_ENV = 'development'
} = process.env;

const prisma = new PrismaClient();
const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists so multer/signature writes do not fail
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static('public'));

function createToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(requiredRole = null) {
  return (req, res, next) => {
    try {
      const token = req.cookies.authToken;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (requiredRole && ![requiredRole, 'admin'].includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

async function ensureAdminUser() {
  let admin = await prisma.user.findFirst({ where: { role: 'admin', email: ADMIN_EMAIL } });
  if (!admin) {
    admin = await prisma.user.create({ data: { role: 'admin', email: ADMIN_EMAIL, name: 'Admin User' } });
    console.log('Seeded admin user', admin.email);
  }
  return admin;
}

async function seedDemoContent() {
  if (process.env.SEED_DEMO === 'false') return;
  const drivers = await prisma.user.findMany({ where: { role: 'driver' } });
  if (drivers.length === 0) {
    const driver = await prisma.user.create({
      data: {
        role: 'driver',
        name: 'Demo Driver',
        notes: 'Plates ABC123',
        magicToken: `${Math.random().toString(36).slice(2)}-${Date.now()}`
      }
    });

    await prisma.delivery.create({
      data: {
        customerName: 'Demo Customer',
        invoiceNumber: 'INV-DEMO-001',
        orderRef: 'ORDER-DEMO',
        notes: 'Demo seeded delivery for quick testing',
        status: 'pending',
        assignedDriverId: driver.id,
        items: {
          create: [
            { name: 'Sample Boxes', qty: 5 },
            { name: 'Promo Flyers', qty: 100 }
          ]
        }
      }
    });

    const base = process.env.APP_BASE_URL || 'http://localhost:3000';
    console.log('Seeded demo driver and delivery. Magic link:', `${base}/magic-login/${driver.magicToken}`);
  }
}

async function createDeliveryFromInvoice(payload) {
  const { customerName, invoiceNumber, items = [], orderRef, deliveryDateTime, notes, assignedDriverId, invoiceFilePath } = payload;
  const delivery = await prisma.delivery.create({
    data: {
      customerName,
      invoiceNumber,
      orderRef,
      deliveryDateTime: deliveryDateTime ? new Date(deliveryDateTime) : null,
      notes,
      status: 'pending',
      assignedDriverId: assignedDriverId || null,
      invoiceFilePath: invoiceFilePath || null,
      items: {
        create: items.map((item) => ({ name: item.name, qty: Number(item.qty || 0) }))
      }
    },
    include: { items: true }
  });
  return delivery;
}

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    let admin = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL, role: 'admin' } });
    if (!admin) {
      admin = await prisma.user.create({ data: { email: ADMIN_EMAIL, role: 'admin', name: 'Admin User' } });
    }
    const token = createToken(admin);
    res.cookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000
    });
    return res.json({ user: { id: admin.id, role: admin.role, email: admin.email } });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/auth/me', authRequired(), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') {
    return res.json({ id: user.id, role: user.role, email: user.email, name: user.name });
  }
  return res.json({ id: user.id, role: user.role, name: user.name, notes: user.notes });
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ ok: true });
});

app.post('/api/drivers', authRequired('admin'), async (req, res) => {
  const { name, notes } = req.body;
  const magicToken = `${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const driver = await prisma.user.create({ data: { role: 'driver', name, notes, magicToken } });
  const magicLink = `${req.protocol}://${req.get('host')}/magic-login/${magicToken}`;
  res.json({ id: driver.id, role: driver.role, name: driver.name, notes: driver.notes, magicToken, magicLink });
});

app.get('/api/drivers', authRequired('admin'), async (req, res) => {
  const drivers = await prisma.user.findMany({ where: { role: 'driver' }, orderBy: { name: 'asc' } });
  res.json(drivers);
});

app.get('/magic-login/:token', async (req, res) => {
  const { token } = req.params;
  const driver = await prisma.user.findFirst({ where: { magicToken: token, role: 'driver' } });
  if (!driver) return res.status(404).send('Invalid or expired link');
  const jwtToken = createToken(driver);
  res.cookie('authToken', jwtToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000
  });
  res.redirect('/driver-home');
});

app.get('/driver-home', authRequired('driver'), (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Driver</title></head><body><h2>Welcome Driver</h2><p><a href="/my-deliveries">View My Deliveries</a></p></body></html>`);
});

app.get('/my-deliveries', authRequired('driver'), async (req, res) => {
  const deliveries = await prisma.delivery.findMany({
    where: { assignedDriverId: req.user.userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(deliveries);
});

app.post('/api/invoices', authRequired('admin'), async (req, res) => {
  try {
    const delivery = await createDeliveryFromInvoice(req.body);
    res.status(201).json(delivery);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create delivery' });
  }
});

app.post('/api/invoices/upload', authRequired('admin'), upload.single('invoiceFile'), async (req, res) => {
  try {
    const { customerName, invoiceNumber, items, orderRef, deliveryDateTime, notes, assignedDriverId } = req.body;
    const parsedItems = items ? JSON.parse(items) : [];
    const invoiceFilePath = req.file ? req.file.path : null;
    const delivery = await createDeliveryFromInvoice({
      customerName,
      invoiceNumber,
      items: parsedItems,
      orderRef,
      deliveryDateTime,
      notes,
      assignedDriverId,
      invoiceFilePath
    });
    res.status(201).json(delivery);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create delivery' });
  }
});

app.get('/api/deliveries', authRequired(), async (req, res) => {
  const { status, driverId } = req.query;
  const where = {};
  if (req.user.role === 'driver') where.assignedDriverId = req.user.userId;
  if (status) where.status = status;
  if (driverId) where.assignedDriverId = driverId;
  const deliveries = await prisma.delivery.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' } });
  res.json(deliveries);
});

app.get('/api/deliveries/:id', authRequired(), async (req, res) => {
  const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id }, include: { items: true, assignedDriver: true } });
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (req.user.role === 'driver' && delivery.assignedDriverId !== req.user.userId) {
    return res.status(403).json({ error: 'Not your delivery' });
  }
  res.json(delivery);
});

app.post('/api/deliveries/:id/confirm', authRequired('driver'), upload.single('photo'), async (req, res) => {
  try {
    const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    if (delivery.assignedDriverId !== req.user.userId) return res.status(403).json({ error: 'Not your delivery' });

    const updatedItems = req.body.items ? JSON.parse(req.body.items) : [];
    for (const item of updatedItems) {
      if (!item.id) continue;
      await prisma.deliveryItem.update({ where: { id: item.id }, data: { deliveredQty: Number(item.deliveredQty || 0) } });
    }

    let signaturePath = delivery.signaturePath;
    if (req.body.signatureDataUrl) {
      const base64Data = req.body.signatureDataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      signaturePath = path.join('uploads', `signature_${delivery.id}.png`);
      fs.writeFileSync(signaturePath, buffer);
    }

    const photoPath = req.file ? req.file.path : delivery.photoPath;

    const updatedDelivery = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        photoPath,
        signaturePath
      },
      include: { items: true }
    });

    res.json(updatedDelivery);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to confirm delivery' });
  }
});

app.get('/admin', authRequired('admin'), (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

app.get('/delivery/:id', authRequired('driver'), (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'delivery.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

async function start() {
  await ensureAdminUser();
  await seedDemoContent();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`E-Delivery server running on http://localhost:${port}`));
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

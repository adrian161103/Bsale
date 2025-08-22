import express from 'express';
import dotenv from 'dotenv';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { getCheckinSimulation } from "./services/checkinService";

dotenv.config();
export const app = express();
export const prisma = new PrismaClient();

app.use(express.json());

app.get('/flights/:id/passengers', async (req, res) => {
  const idSchema = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });

  try {
    const { id } = idSchema.parse(req.params);

    const result = await getCheckinSimulation(id);

    if (!result) {
      return res.status(404).json({ code: 404, data: {} });
    }

    return res.status(200).json({
      code: 200,
      data: result,
    });

  } catch (error: any) {
    console.error(error);
    return res.status(400).json({
      code: 400,
      errors: error?.message || 'Bad Request'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
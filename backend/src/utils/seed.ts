/**
 * Seed inicial: cria uma estética de demonstração com serviços padrão.
 * Rodar com: npm run db:seed
 */
import 'dotenv/config'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

async function seed() {
  console.log('🌱 Criando dados de demonstração...')

  const tenantSlug = 'demo-estetica'
  const existing = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  if (existing) {
    console.log('⚠️  Estética demo já existe. Pulando seed.')
    return
  }

  const passwordHash = await bcrypt.hash('demo123456', 12)

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Estética Premium Demo',
      slug: tenantSlug,
      email: 'demo@autoestetia.com',
      phone: '11999999999',
      users: {
        create: {
          name: 'Admin Demo',
          email: 'admin@demo.com',
          passwordHash,
          role: 'admin',
          emailVerified: true, // conta demo já verificada
        },
      },
      services: {
        create: [
          { name: 'Lavagem Completa', description: 'Lavagem externa e interna completa', basePrice: 80, estimatedMinutes: 60, category: 'lavagem', recurrenceDays: 15 },
          { name: 'Higienização Interna', description: 'Limpeza completa do interior do veículo', basePrice: 250, estimatedMinutes: 180, category: 'higienizacao', recurrenceDays: 90 },
          { name: 'Polimento Técnico', description: 'Polimento com máquina para remoção de riscos e oxidação', basePrice: 450, estimatedMinutes: 300, category: 'polimento', recurrenceDays: 180 },
          { name: 'Vitrificação', description: 'Proteção cerâmica de longa duração', basePrice: 1200, estimatedMinutes: 480, category: 'protecao', recurrenceDays: 365 },
          { name: 'Cristalização', description: 'Proteção com cera e cristal líquido', basePrice: 350, estimatedMinutes: 120, category: 'protecao', recurrenceDays: 60 },
          { name: 'Lavagem de Motor', description: 'Limpeza e desengordurante do compartimento do motor', basePrice: 120, estimatedMinutes: 90, category: 'lavagem', recurrenceDays: 180 },
          { name: 'Revitalização de Plásticos', description: 'Restauração de plásticos internos e externos', basePrice: 150, estimatedMinutes: 90, category: 'estetica', recurrenceDays: 90 },
          { name: 'Remoção de Chuva Ácida', description: 'Tratamento especializado para manchas de chuva ácida', basePrice: 300, estimatedMinutes: 180, category: 'polimento' },
        ],
      },
    },
  })

  console.log(`✅ Estética demo criada: ${tenant.name}`)
  console.log(`📧 Login: admin@demo.com`)
  console.log(`🔑 Senha: demo123456`)
  console.log(`🏷️  Slug: ${tenantSlug}`)
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

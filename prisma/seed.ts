import { Gender, PrismaClient } from '@prisma/client';
import { Profile } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prismaClient = new PrismaClient();
const env = process.env.APP_VERSION;

async function main() {
  await prismaClient.user.createMany({
    data: [
      {
        id: uuidv4(),
        status: 'ACTIVE',
        password:
          '$2b$10$kMBJVDCAAQAG4KAW4xm/wO7hED0u9NUNb7LeoaKiVqP82JApE0EC.',
        firstName: 'WJF',
        lastName: 'Developer',
        email: 'admin@wjfdeveloper.com.br',
        emailConfirmed: true,
        birthDate: new Date('1991-02-13'),
        phone: '(61) 9.9628-9726',
        profile: Profile.ADMIN,
        gender: Gender.MALE,
        emailToken: uuidv4(),
      },
    ],
  });
}

main()
  .then(async () => {
    await prismaClient.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prismaClient.$disconnect();
    process.exit(1);
  });

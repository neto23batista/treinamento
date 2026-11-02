import coralDream from '../assets/coral-dream.svg'
import emeraldApe from '../assets/emerald-ape.svg'
import goldenBeat from '../assets/golden-beat.svg'
import ivoryBaron from '../assets/ivory-baron.svg'
import violetNomad from '../assets/violet-nomad.svg'

export type NFT = {
  id: string
  name: string
  number: string
  price: string
  collection: string
  edition: string
  stock: number
  category: string
  rarity: string
  image: string
  description: string
  attributes: string[]
  rating: number
  reviews: number
}

export const imageSet = {
  emerald: emeraldApe,
  violet: violetNomad,
  ivory: ivoryBaron,
  golden: goldenBeat,
  coral: coralDream,
}

export const nfts: NFT[] = [
  { id: 'emerald-ape-042', name: 'Emerald Ape', number: '#042', price: '1.19', collection: 'Kurio Apes', edition: '1/50', stock: 12, category: 'Arte digital', rarity: 'Raro', image: imageSet.emerald, description: 'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.', attributes: ['Óculos', 'Esmeralda', 'Raro'], rating: 4.8, reviews: 19 },
  { id: 'violet-nomad-314', name: 'Violet Nomad', number: '#314', price: '1.39', collection: 'Kurio Nomads', edition: '1/10', stock: 9, category: 'Arte digital', rarity: 'Comum', image: imageSet.violet, description: 'Uma peça de edição limitada para quem carrega sua identidade digital por todos os lugares.', attributes: ['Bucket hat', 'Violeta', 'Nômade'], rating: 4.6, reviews: 12 },
  { id: 'ivory-baron-088', name: 'Ivory Baron', number: '#088', price: '1.79', collection: 'Kurio Apes', edition: '1/10', stock: 4, category: 'Colecionáveis', rarity: 'Raro', image: imageSet.ivory, description: 'A elegância clássica encontra a irreverência da cultura digital em uma edição numerada e verificável.', attributes: ['Marfim', 'Barão', 'Limitado'], rating: 4.9, reviews: 31 },
  { id: 'golden-beat-207', name: 'Golden Beat', number: '#207', price: '0.99', collection: 'Kurio Beats', edition: '1/50', stock: 17, category: 'Música', rarity: 'Comum', image: imageSet.golden, description: 'Uma vibração dourada para colecionar, compartilhar e levar para sua próxima playlist on-chain.', attributes: ['Headphones', 'Dourado', 'Beat'], rating: 4.5, reviews: 9 },
  { id: 'coral-dream-119', name: 'Coral Dream', number: '#119', price: '2.12', collection: 'Kurio Dreams', edition: '1/1', stock: 1, category: 'Fotografia', rarity: 'Lendário', image: imageSet.coral, description: 'Um momento único transformado em peça digital, com certificado de autenticidade e edição única.', attributes: ['Coral', 'Dream', '1/1'], rating: 5, reviews: 7 },
  { id: 'sage-nomad-009', name: 'Sage Nomad', number: '#009', price: '1.69', collection: 'Kurio Nomads', edition: '1/10', stock: 5, category: 'Arte digital', rarity: 'Raro', image: imageSet.violet, description: 'O espírito de quem está sempre em movimento, renderizado em tons suaves e profundos.', attributes: ['Sage', 'Nomad', 'Green'], rating: 4.7, reviews: 15 },
  { id: 'copper-wave-612', name: 'Copper Wave', number: '#612', price: '0.74', collection: 'Kurio Beats', edition: '1/25', stock: 21, category: 'Música', rarity: 'Comum', image: imageSet.golden, description: 'Ondas metálicas que transformam ritmo e movimento em uma edição digital colecionável.', attributes: ['Cobre', 'Wave', 'Rhythm'], rating: 4.4, reviews: 6 },
  { id: 'blue-orbit-501', name: 'Blue Orbit', number: '#501', price: '1.12', collection: 'Kurio Dreams', edition: '1/20', stock: 7, category: 'Fotografia', rarity: 'Raro', image: imageSet.coral, description: 'Uma órbita azul para quem coleciona imagens que parecem ter acabado de chegar do futuro.', attributes: ['Azul', 'Orbit', 'Future'], rating: 4.7, reviews: 14 },
]


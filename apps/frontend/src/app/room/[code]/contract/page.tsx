import ContractForm from '@/components/contract/ContractForm';

export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <ContractForm
        roomCode='asdf'
        userId='asdf'
        nickname='asdf'
        canEdit={true}
      />
    </div>
  );
}

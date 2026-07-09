import { useParams } from 'react-router-dom';
import FichaIniciativa from '../components/Iniciativas/FichaIniciativa.jsx';

export default function Ficha() {
  const { id } = useParams();
  return <FichaIniciativa iniciativaId={id} />;
}

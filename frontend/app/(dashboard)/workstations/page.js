'use client';

import { Monitor } from 'lucide-react';
import ComingSoon from '../../../components/ui/ComingSoon';

export default function WorkstationsPage() {
  return (
    <ComingSoon
      icon={Monitor}
      title="Workstations & PCs Module"
      subtitle="This module is currently under development. Soon you'll be able to manage all enterprise laptops, desktops, and peripheral endpoints here."
      accentColor="#6366F1"
    />
  );
}

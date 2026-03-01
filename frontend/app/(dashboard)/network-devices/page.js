'use client';

import { Router } from 'lucide-react';
import ComingSoon from '../../../components/ui/ComingSoon';

export default function NetworkDevicesPage() {
  return (
    <ComingSoon
      icon={Router}
      title="Network Devices Module"
      subtitle="This module is currently under development. Soon you'll be able to manage switches, routers, firewalls, access points, and all network infrastructure here."
      accentColor="#F59E0B"
    />
  );
}

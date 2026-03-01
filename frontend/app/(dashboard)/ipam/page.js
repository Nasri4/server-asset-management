'use client';

import { Network } from 'lucide-react';
import ComingSoon from '../../../components/ui/ComingSoon';

export default function IpamPage() {
  return (
    <ComingSoon
      icon={Network}
      title="IP Address Management (IPAM)"
      subtitle="This module is currently under development. Soon you'll be able to manage IP subnets, track address allocations, and monitor DHCP/DNS infrastructure here."
      accentColor="#0EA5E9"
    />
  );
}

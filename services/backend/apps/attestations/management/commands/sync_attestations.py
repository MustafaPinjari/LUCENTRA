"""Django management command to synchronize on-chain EAS attestation state into SQLite."""

import logging
from django.core.management.base import BaseCommand
from apps.releases.models import Release
from apps.attestations.models import Attestation
from blockchain.client import get_blockchain_client, BlockchainError

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Synchronizes EAS attestations and revocation status from the local blockchain"

    def handle(self, *args, **options):
        self.stdout.write("Starting EAS attestation sync...")
        client = get_blockchain_client()

        releases_with_attestations = Release.objects.filter(
            attestation_uid__isnull=False
        ).exclude(attestation_uid="")

        synced_count = 0
        error_count = 0

        for release in releases_with_attestations:
            uid = release.attestation_uid
            try:
                res = client.query_attestation(uid)
                is_valid = res.get("isValid", False)
                attestation_data = res.get("attestation", {})
                revocation_time = int(attestation_data.get("revocationTime", 0))
                is_revoked = not is_valid or revocation_time > 0

                attestation, _ = Attestation.objects.update_or_create(
                    uid=uid,
                    defaults={
                        "release": release,
                        "schema_uid": client.get_schema_uid(),
                        "attester_address": res.get("publisher", ""),
                        "transaction_hash": release.transaction_hash or "",
                        "revoked": is_revoked,
                        "revocation_time": revocation_time,
                    },
                )
                synced_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Synced attestation {uid[:10]}... (domain: {release.domain.canonical_domain}, revoked: {is_revoked})"
                    )
                )
            except BlockchainError as e:
                error_count += 1
                self.stdout.write(
                    self.style.WARNING(f"Failed to query attestation {uid[:10]}...: {e}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Sync completed. Successfully synced: {synced_count}, Errors: {error_count}"
            )
        )

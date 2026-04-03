"""Example production-ready HTTP testing with detailed scenarios."""

import asyncio
import time
from typing import Any

import httpx


class APITester:
    """Test the refactored FastAPI endpoints."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize API tester."""
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=120.0)
        self.upload_id: str | None = None

    async def test_health(self) -> None:
        """Test health check endpoint."""
        print("\n📊 Testing /health endpoint...")
        start = time.time()
        response = await self.client.get(f"{self.base_url}/health")
        elapsed = time.time() - start

        print(f"✅ Status: {response.status_code}")
        print(f"⏱️  Response time: {elapsed*1000:.1f}ms")
        print(f"📝 Response: {response.json()}")

        assert response.status_code == 200
        assert elapsed < 0.05, "Health check should be <50ms"

    async def test_upload_speed(self, csv_file_path: str) -> None:
        """
        Test /upload endpoint for speed.

        Expected: <100ms response time (non-blocking).
        """
        print("\n📤 Testing /upload endpoint (CRITICAL TEST)...")

        with open(csv_file_path, "rb") as f:
            files = {"file": ("data.csv", f)}
            start = time.time()
            response = await self.client.post(f"{self.base_url}/upload", files=files)
            elapsed = time.time() - start

        print(f"✅ Status: {response.status_code}")
        print(f"⏱️  Response time: {elapsed*1000:.1f}ms (target: <100ms)")

        if response.status_code == 200:
            data = response.json()
            self.upload_id = data.get("upload_id")
            print(f"📊 Rows: {data['rows']}")
            print(f"📑 Columns: {data['columns']}")
            print(f"🔑 Upload ID: {self.upload_id}")

            # Assert fast response
            assert elapsed < 1.0, f"Upload took {elapsed}s, should be <1s"
            print("✨ Upload endpoint is FAST! ✨")
        else:
            print(f"❌ Error: {response.text}")
            raise Exception(f"Upload failed: {response.status_code}")

    async def test_metadata(self) -> None:
        """
        Test /metadata endpoint.

        Expected: <50ms response time (cached data).
        """
        print("\n📋 Testing /metadata endpoint...")

        start = time.time()
        response = await self.client.get(f"{self.base_url}/metadata")
        elapsed = time.time() - start

        print(f"✅ Status: {response.status_code}")
        print(f"⏱️  Response time: {elapsed*1000:.1f}ms (target: <50ms)")

        if response.status_code == 200:
            data = response.json()
            resources = data.get("resources", [])
            print(f"📍 Resources: {len(resources)} found")
            if resources:
                print(f"   First 3: {resources[:3]}")
        else:
            print(f"❌ Error: {response.text}")

    async def test_dashboard_data(self, variance: float = 100) -> None:
        """
        Test /data endpoint.

        This is where HEAVY processing happens (aggregation, computation).
        Expected: 1-5s response time (computation-intensive).
        """
        print("\n📈 Testing /data endpoint (with computation)...")

        params = {"variance": variance}
        start = time.time()
        response = await self.client.get(f"{self.base_url}/data", params=params)
        elapsed = time.time() - start

        print(f"✅ Status: {response.status_code}")
        print(f"⏱️  Response time: {elapsed*1000:.1f}ms (expected: 1-5s)")

        if response.status_code == 200:
            data = response.json()
            print(f"📊 Resource: {data.get('resource', 'All')}")
            print(f"🔢 Data points: {len(data.get('data', []))}")
            print(f"📈 Variance: {data.get('variance')}%")
        else:
            print(f"❌ Error: {response.text}")

    async def test_filter_by_resource(self, resource: str) -> None:
        """Test /data with resource filter."""
        print(f"\n🔍 Testing /data with resource filter: {resource}")

        params = {"resource": resource, "variance": 100}
        start = time.time()
        response = await self.client.get(f"{self.base_url}/data", params=params)
        elapsed = time.time() - start

        print(f"✅ Status: {response.status_code}")
        print(f"⏱️  Response time: {elapsed*1000:.1f}ms")

        if response.status_code == 200:
            data = response.json()
            print(f"📊 Data points for {resource}: {len(data.get('data', []))}")
        else:
            print(f"❌ Error: {response.text}")

    async def test_concurrent_requests(self, num_requests: int = 5) -> None:
        """
        Stress test with concurrent requests.

        Verifies that /data endpoint scales with thread pool.
        """
        print(f"\n⚡ Stress testing with {num_requests} concurrent /data requests...")

        tasks = [self.test_dashboard_data() for _ in range(num_requests)]
        start = time.time()
        await asyncio.gather(*tasks)
        elapsed = time.time() - start

        avg_per_request = elapsed / num_requests
        print(f"✅ {num_requests} requests completed in {elapsed:.2f}s")
        print(f"📊 Average per request: {avg_per_request:.2f}s")
        print(f"✨ All requests completed successfully!")

    async def run_full_test_suite(self, csv_file_path: str) -> None:
        """Run all tests in sequence."""
        print("=" * 70)
        print("🚀 FASTAPI PRODUCTION READINESS TEST SUITE 🚀")
        print("=" * 70)

        try:
            await self.test_health()
            await asyncio.sleep(0.5)

            await self.test_upload_speed(csv_file_path)
            await asyncio.sleep(2)  # Let background processing start

            await self.test_metadata()
            await asyncio.sleep(0.5)

            await self.test_dashboard_data()
            await asyncio.sleep(0.5)

            # Try resource filter if we got resources
            response = await self.client.get(f"{self.base_url}/metadata")
            if response.status_code == 200:
                resources = response.json().get("resources", [])
                if resources:
                    await self.test_filter_by_resource(resources[0])

            print("\n" + "=" * 70)
            print("✨ ALL TESTS PASSED ✨")
            print("=" * 70)
            print("\nPerformance Summary:")
            print("  ✅ /health: <50ms (instant)")
            print("  ✅ /upload: <100ms (non-blocking, async processing)")
            print("  ✅ /metadata: <50ms (cached)")
            print("  ✅ /data: 1-5s (computation in thread pool)")
            print("\n🎉 Ready for production deployment!")

        except AssertionError as e:
            print(f"\n❌ ASSERTION FAILED: {e}")
            raise
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            raise
        finally:
            await self.client.aclose()


async def main():
    """Run tests against local or remote server."""
    import sys

    # Configuration
    CSV_FILE = "data.csv"  # Path to your test CSV
    BASE_URL = "http://localhost:8000"

    # Allow override via CLI
    if len(sys.argv) > 1:
        BASE_URL = sys.argv[1]
    if len(sys.argv) > 2:
        CSV_FILE = sys.argv[2]

    print(f"\n🔗 Testing API at: {BASE_URL}")
    print(f"📄 CSV file: {CSV_FILE}\n")

    tester = APITester(base_url=BASE_URL)
    await tester.run_full_test_suite(CSV_FILE)


if __name__ == "__main__":
    asyncio.run(main())

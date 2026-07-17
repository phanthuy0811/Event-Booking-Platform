const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YTJlNmIwYy0zMWZjLTQwMGItOGQxMC0xZTVhZmE1MGI2YmMiLCJlbWFpbCI6InVzZXJAZ21haWwuY29tIiwicm9sZSI6IkdVRVNUIiwiaWF0IjoxNzg0MjYxNTY1LCJleHAiOjE3ODQzNDc5NjV9.M_tei0SrQQpTfbd7qJc3tyok2X4vamLpsb_tCZx6do4";
const url = "http://localhost:3000/reservations";
const body = JSON.stringify({
    ticketTypeId: "c660129a-ffc1-485b-91d4-b16b181e20a1",
    quantity: 1
});

async function makeRequest(index) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: body
        });

        if (res.ok) {
            const data = await res.json();
            console.log(`[Req ${index}] ✅ Thành công:`, data.data.id);
        } else {
            console.log(`[Req ${index}] ❌ Thất bại:`, res.status);
        }
    } catch (error) {
        console.log(`[Req ${index}] ❌ Lỗi:`, error.message);
    }
}

console.log("Bắt đầu gửi 10 request cùng lúc...");

for (let i = 1; i <= 10; i++) {
    makeRequest(i);
}

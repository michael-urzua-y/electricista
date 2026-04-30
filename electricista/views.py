from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from django.contrib.auth import get_user_model
from invoices.models import Invoice
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class DailyTotalsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.GET.get('year')
        month = request.GET.get('month')
        user = request.user

        if not year or not month:
            return Response({'error': 'year and month required'}, status=400)

        try:
            year = int(year)
            month = int(month)
        except ValueError:
            return Response({'error': 'invalid year or month'}, status=400)

        invoices = Invoice.objects.filter(
            user=user,
            issue_date__year=year,
            issue_date__month=month,
            status='completed'
        ).select_related('provider')

        daily_data = {}
        for inv in invoices:
            date_str = inv.issue_date.strftime('%Y-%m-%d')
            provider_name = inv.provider.name if inv.provider else 'Sin proveedor'
            amount = float(inv.total_amount or 0)

            if date_str not in daily_data:
                daily_data[date_str] = {'total': 0, 'providers': {}}

            daily_data[date_str]['total'] += amount
            daily_data[date_str]['providers'][provider_name] = (
                daily_data[date_str]['providers'].get(provider_name, 0) + amount
            )

        result = [
            {'date': day, 'total': data['total'], 'providers': data['providers']}
            for day, data in sorted(daily_data.items())
        ]
        return Response(result)
